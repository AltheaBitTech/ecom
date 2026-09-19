import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PayoutsService } from './payouts.service';
import type { SubscriptionPayment } from '@prisma/client';

/**
 * Default commission rate (basis points, 1000 = 10%) a referrer earns on a referee's
 * subscription payment. A platform admin can override this per-referrer via
 * ReferralCode.commissionBps (e.g. for a VIP partner) — see setRate() below.
 */
export const PLATFORM_DEFAULT_BPS = 1000;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutsService,
  ) {}

  /** Issues a referral code for the tenant if it doesn't already have one (idempotent). */
  async issueCode(tenantId: string, tenantSlug: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.referralCode.findUnique({ where: { tenantId } });
    if (existing) return existing;

    // ponytail: slug + 4 random hex chars, retried on the rare collision — no need for a
    // fancier scheme (nanoid/etc) for a code that's just a shareable, memorable suffix.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `${slugify(tenantSlug)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
      try {
        return await scoped.referralCode.create({ data: { tenantId, code } });
      } catch (err) {
        if (!(err as { code?: string }).code || (err as { code?: string }).code !== 'P2002') throw err;
      }
    }
    throw new ConflictException('Could not generate a unique referral code');
  }

  async getMine(tenantId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const referralCode = await scoped.referralCode.findUnique({
      where: { tenantId },
      include: {
        referrals: {
          include: { refereeTenant: { select: { id: true, name: true } }, commissions: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!referralCode) return null;

    const allCommissions = referralCode.referrals.flatMap((r) => r.commissions);
    return {
      code: referralCode.code,
      commissionBps: referralCode.commissionBps ?? PLATFORM_DEFAULT_BPS,
      payoutVpa: referralCode.payoutVpa,
      referrals: referralCode.referrals.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        refereeTenant: r.refereeTenant,
        commissions: r.commissions,
      })),
      totalEarnedCents: allCommissions.reduce((sum, c) => sum + c.amountCents, 0),
      totalPaidCents: allCommissions.filter((c) => c.status === 'PAID').reduce((sum, c) => sum + c.amountCents, 0),
    };
  }

  /**
   * Called from tenant registration when a `?ref=CODE` was supplied. Invalid/unknown codes
   * and self-referrals are silently ignored — a bad referral code should never block signup.
   */
  async createReferral(refereeTenantId: string, code: string | undefined): Promise<void> {
    if (!code) return;
    const referralCode = await this.prisma.referralCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!referralCode || referralCode.tenantId === refereeTenantId) return;

    await this.prisma.referral.create({
      data: { referralCodeId: referralCode.id, refereeTenantId, status: 'PENDING' },
    }).catch(() => undefined); // refereeTenantId is @unique — a tenant can only ever be referred once
  }

  /**
   * Records a commission for a paid subscription payment, if the paying tenant was referred.
   * Flips the referral PENDING -> ACTIVE on its first paid commission.
   */
  async recordCommission(subscriptionPayment: SubscriptionPayment & { subscription: { tenantId: string } }): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { refereeTenantId: subscriptionPayment.subscription.tenantId },
      include: { referralCode: true },
    });
    if (!referral) return;

    if (referral.status === 'PENDING') {
      await this.prisma.referral.update({ where: { id: referral.id }, data: { status: 'ACTIVE' } });
    }

    const rateBps = referral.referralCode.commissionBps ?? PLATFORM_DEFAULT_BPS;
    const amountCents = Math.round((subscriptionPayment.amountCents * rateBps) / 10000);

    await this.prisma.referralCommission.create({
      data: {
        referralId: referral.id,
        subscriptionPaymentId: subscriptionPayment.id,
        rateBps,
        amountCents,
        status: 'PENDING',
      },
    });
  }

  /**
   * Platform-admin action: pay out a commission. If RazorpayX is configured and the referrer
   * has a payout VPA on file, actually sends the money and records the payout id. Otherwise
   * falls back to marking it PAID for manual settlement outside the system — never blocks the
   * admin from recording a commission as paid just because payout automation isn't set up.
   */
  async markCommissionPaid(commissionId: string) {
    const commission = await this.prisma.referralCommission.findUnique({
      where: { id: commissionId },
      include: { referral: { include: { referralCode: true, refereeTenant: { select: { name: true } } } } },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.status === 'PAID') return commission;

    const vpa = commission.referral.referralCode.payoutVpa;
    let payoutId: string | null = null;
    if (vpa && this.payouts.isConfigured()) {
      try {
        payoutId = await this.payouts.payToVpa({
          vpa,
          amountCents: commission.amountCents,
          referrerName: commission.referral.referralCode.code,
          reference: commission.id,
        });
      } catch (err) {
        // Payout automation failing is not a reason to block a platform admin from recording
        // the commission as settled manually — log it and fall through to the manual path.
        this.logger.warn(`Automatic payout failed for commission ${commissionId}: ${(err as Error).message}`);
      }
    }

    return this.prisma.referralCommission.update({
      where: { id: commissionId },
      data: { status: 'PAID', paidAt: new Date(), payoutId },
    });
  }

  /** Tenant self-service: set (or clear) the UPI VPA commission payouts should be sent to. */
  async setPayoutVpa(tenantId: string, payoutVpa: string | null) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.referralCode.findUnique({ where: { tenantId } });
    if (!existing) throw new NotFoundException('No referral code yet — issue one first');
    return scoped.referralCode.update({ where: { tenantId }, data: { payoutVpa } });
  }

  /** Platform-admin action: set (or clear, with null) a VIP commission rate override for a tenant's referral code. */
  async setRate(tenantId: string, commissionBps: number | null) {
    return this.prisma.referralCode.update({ where: { tenantId }, data: { commissionBps } });
  }
}
