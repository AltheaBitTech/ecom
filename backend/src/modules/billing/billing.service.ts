import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EnvConfig } from '../../common/config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';

export interface BillingWebhookEvent {
  event: string;
  payload: {
    subscription?: { entity: { id: string; status: string; current_end?: number } };
    payment?: { entity: { id: string; amount: number } };
  };
}

const SUBSCRIPTION_INCLUDE = { plan: true, payments: { orderBy: { createdAt: 'desc' as const } } };

@Injectable()
export class BillingService {
  private readonly client: Razorpay | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly referrals: ReferralsService,
    private readonly notifications: NotificationsService,
  ) {
    const keyId = this.config.get('RAZORPAY_KEY_ID', { infer: true });
    const keySecret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    // Same lazy-construction pattern as PaymentsService — never breaks boot if unconfigured.
    this.client = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  private requireClient(): Razorpay {
    if (!this.client) {
      throw new InternalServerErrorException('Billing is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
    }
    return this.client;
  }

  listPlans() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' } });
  }

  getSubscription(tenantId: string) {
    return this.prisma.forTenant(tenantId).subscription.findUnique({ where: { tenantId }, include: SUBSCRIPTION_INCLUDE });
  }

  /**
   * Creates a Razorpay subscription for the plan and a local Subscription row (TRIALING or
   * ACTIVE per Razorpay's returned status).
   *
   * ponytail: our Plan model has no field to cache a Razorpay plan id, so a Razorpay Plan is
   * (re)created on every subscribe call. Cheap and correct, just wasteful of Razorpay's Plan
   * list. Upgrade path: add Plan.razorpayPlanId once the schema reopens, and reuse it here.
   */
  async subscribe(tenantId: string, planId: string, notifyKind: 'created' | 'upgraded' = 'created') {
    const razorpay = this.requireClient();
    const scoped = this.prisma.forTenant(tenantId);

    const existing = await scoped.subscription.findUnique({ where: { tenantId } });
    if (existing) throw new ConflictException('Tenant already has a subscription');

    const plan = await this.prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new NotFoundException('Plan not found');

    const razorpayPlan = await razorpay.plans.create({
      period: 'daily',
      interval: plan.intervalDays,
      item: { name: plan.name, amount: plan.priceCents, currency: plan.currency },
    });

    // total_count: no fixed end date for a SaaS subscription, so ask for a very long run
    // (10 years of daily-interval cycles) rather than modeling "forever" specially.
    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlan.id,
      total_count: Math.ceil(3650 / plan.intervalDays),
      notes: { tenantId, planId: plan.id },
    });

    const subscription = await scoped.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: razorpaySubscription.status === 'active' ? 'ACTIVE' : 'TRIALING',
        razorpaySubscriptionId: razorpaySubscription.id,
        currentPeriodEnd: razorpaySubscription.current_end ? new Date(razorpaySubscription.current_end * 1000) : null,
      },
      include: SUBSCRIPTION_INCLUDE,
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (tenant) void this.notifications.notifySubscriptionEvent(tenant, subscription, notifyKind);

    return { subscription, razorpayKeyId: this.config.get('RAZORPAY_KEY_ID', { infer: true }), razorpaySubscriptionId: razorpaySubscription.id };
  }

  /**
   * Upgrade/change plan: cancels the tenant's existing Razorpay subscription and creates a
   * fresh one for the new plan, marking the old local row CANCELLED — smaller diff than
   * modifying the Razorpay subscription in place, and reuses subscribe()'s creation logic.
   */
  async changePlan(tenantId: string, newPlanId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.subscription.findUnique({ where: { tenantId } });
    if (!existing) throw new NotFoundException('Tenant has no subscription to change');
    if (existing.planId === newPlanId) throw new ConflictException('Tenant is already on this plan');

    const razorpay = this.requireClient();
    if (existing.razorpaySubscriptionId) {
      await razorpay.subscriptions.cancel(existing.razorpaySubscriptionId).catch(() => undefined);
    }
    await scoped.subscription.delete({ where: { tenantId } });

    return this.subscribe(tenantId, newPlanId, 'upgraded');
  }

  /** Verifies the webhook signature over the raw request body — same HMAC approach as PaymentsService. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Applies a verified webhook event. Looked up by razorpaySubscriptionId (globally unique)
   * rather than through forTenant, since the webhook carries no tenant context — safe only
   * because the caller has already verified the signature before reaching here.
   */
  async applyWebhookEvent(event: BillingWebhookEvent): Promise<void> {
    const subEntity = event.payload.subscription?.entity;
    if (!subEntity) return;

    const subscription = await this.prisma.subscription.findUnique({ where: { razorpaySubscriptionId: subEntity.id }, include: { plan: true } });
    if (!subscription) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: subscription.tenantId }, select: { id: true, name: true } });

    if (event.event === 'subscription.charged') {
      const paymentEntity = event.payload.payment?.entity;
      // Razorpay retries a webhook until it gets a 2xx, so a redelivery must not record the
      // charge — or its referral commission — twice. providerPaymentId is unique, so without
      // this the retry would 500 on the insert and be retried forever.
      if (paymentEntity && await this.prisma.subscriptionPayment.findUnique({ where: { providerPaymentId: paymentEntity.id } })) return;
      const payment = await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          providerPaymentId: paymentEntity?.id,
          amountCents: paymentEntity?.amount ?? 0,
          currency: 'INR',
          status: 'PAID',
          paidAt: new Date(),
        },
      });
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: subEntity.current_end ? new Date(subEntity.current_end * 1000) : subscription.currentPeriodEnd,
        },
      });
      await this.referrals.recordCommission({ ...payment, subscription: { tenantId: subscription.tenantId } });
      if (tenant) void this.notifications.notifySubscriptionEvent(tenant, subscription, 'payment_succeeded');
    } else if (event.event === 'subscription.cancelled') {
      await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } });
      if (tenant) void this.notifications.notifySubscriptionEvent(tenant, subscription, 'cancelled');
    } else if (event.event === 'subscription.halted') {
      await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'PAST_DUE' } });
      if (tenant) void this.notifications.notifySubscriptionEvent(tenant, subscription, 'payment_failed');
    }
    // ponytail: other lifecycle events (authenticated, pending, completed, expired) aren't
    // acted on — add handling when a real flow depends on them.
  }
}
