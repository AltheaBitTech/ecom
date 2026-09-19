import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EnvConfig } from '../../common/config/env.validation';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { campaignSchema, parse, type Audience, type Channel } from './marketing.schemas';

type Recipient = { id: string; name: string; email: string | null; phone: string | null };

// Sent this many at a time. Enough to clear a few thousand recipients quickly without opening
// a thousand sockets at once or tripping a provider's rate limit.
// ponytail: in-process batching, not a job queue — a send that dies with the process is lost
// and the merchant resends. Move to a real queue when campaigns outgrow one box.
const BATCH_SIZE = 20;

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Consent is enforced here and nowhere else, so no caller can route around it: every audience
   * starts from opted-in, never-unsubscribed customers.
   */
  private async recipients(tenantId: string, audience: Audience, customerIds: string[]): Promise<Recipient[]> {
    const scoped = this.prisma.forTenant(tenantId);
    const paidOrder = { some: { status: { not: 'CANCELLED' as const }, payment: { status: 'PAID' as const } } };
    const customers = await scoped.customer.findMany({
      where: {
        marketingOptIn: true,
        unsubscribedAt: null,
        ...(audience === 'selected' ? { id: { in: customerIds } } : {}),
        ...(audience === 'buyers' ? { orders: paidOrder } : {}),
        ...(audience === 'prospects' ? { NOT: { orders: paidOrder } } : {}),
      },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
    return customers;
  }

  /** Recipient count for the compose screen, so the merchant sees the reach before sending. */
  async audiencePreview(tenantId: string, audience: Audience, customerIds: string[], channels: Channel[]) {
    const people = await this.recipients(tenantId, audience, customerIds);
    const reachable = people.filter((p) => this.addressesFor(p, channels).length > 0);
    const optedIn = await this.prisma.forTenant(tenantId).customer.count({ where: { marketingOptIn: true, unsubscribedAt: null } });
    const total = await this.prisma.forTenant(tenantId).customer.count();
    return {
      recipients: reachable.length,
      // Someone in the audience with no email when email is the only channel, etc.
      unreachable: people.length - reachable.length,
      optedIn,
      totalCustomers: total,
    };
  }

  private addressesFor(person: Recipient, channels: Channel[]) {
    const out: { channel: Channel; to: string }[] = [];
    if (channels.includes('email') && person.email) out.push({ channel: 'email', to: person.email });
    if (channels.includes('whatsapp') && person.phone) out.push({ channel: 'whatsapp', to: person.phone });
    if (channels.includes('sms') && person.phone) out.push({ channel: 'sms', to: person.phone });
    return out;
  }

  /**
   * Signed unsubscribe link. The HMAC means the URL works without a login and cannot be forged
   * or enumerated to unsubscribe someone else.
   */
  unsubscribeToken(customerId: string) {
    const secret = this.config.get('JWT_ACCESS_SECRET', { infer: true });
    return crypto.createHmac('sha256', secret).update(`unsubscribe:${customerId}`).digest('hex').slice(0, 32);
  }

  private unsubscribeUrl(customerId: string) {
    const base = this.config.get('FRONTEND_URL', { infer: true });
    return `${base}/unsubscribe?c=${customerId}&t=${this.unsubscribeToken(customerId)}`;
  }

  async unsubscribe(customerId: string, token: string) {
    const expected = this.unsubscribeToken(customerId);
    if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new NotFoundException('This unsubscribe link is not valid');
    }
    // Unscoped by tenant on purpose: the link carries no tenant context, and the HMAC over the
    // customer id is what proves the request is legitimate.
    const { count } = await this.prisma.customer.updateMany({
      where: { id: customerId },
      data: { marketingOptIn: false, unsubscribedAt: new Date() },
    });
    if (!count) throw new NotFoundException('This unsubscribe link is not valid');
    return { unsubscribed: true };
  }

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId).campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /**
   * Records the campaign, then sends in the background and returns immediately — a few thousand
   * provider round-trips must not hang the admin's request. The row's status/counts are what the
   * campaigns screen polls.
   */
  async send(tenantId: string, input: unknown, actorEmail?: string) {
    const dto = parse(campaignSchema, input);
    const people = await this.recipients(tenantId, dto.audience, dto.customerIds);
    const reachable = people.filter((p) => this.addressesFor(p, dto.channels).length > 0);

    const campaign = await this.prisma.forTenant(tenantId).campaign.create({
      data: {
        tenantId,
        subject: dto.subject,
        body: dto.body,
        channels: dto.channels,
        audience: dto.audience,
        recipientCount: reachable.length,
        createdByEmail: actorEmail,
        status: reachable.length ? 'SENDING' : 'SENT',
        completedAt: reachable.length ? null : new Date(),
      },
    });

    if (reachable.length) void this.deliver(campaign.id, reachable, dto.channels, dto.subject, dto.body);
    return campaign;
  }

  private async deliver(campaignId: string, people: Recipient[], channels: Channel[], subject: string, body: string) {
    let sent = 0;
    let failed = 0;
    try {
      for (let i = 0; i < people.length; i += BATCH_SIZE) {
        const batch = people.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map((person) => this.deliverOne(person, channels, subject, body)));
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) sent += 1;
          else failed += 1;
        }
      }
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} delivery aborted: ${String(err)}`);
    }
    await this.prisma.campaign
      .update({ where: { id: campaignId }, data: { sentCount: sent, failedCount: failed, status: failed && !sent ? 'FAILED' : 'SENT', completedAt: new Date() } })
      .catch((err) => this.logger.error(`Campaign ${campaignId} result not recorded: ${String(err)}`));
  }

  /** One recipient counts as reached if any of their channels got through. */
  private async deliverOne(person: Recipient, channels: Channel[], subject: string, body: string): Promise<boolean> {
    const unsubscribe = this.unsubscribeUrl(person.id);
    const greeting = person.name ? `Hi ${person.name},` : 'Hi,';
    const results = await Promise.allSettled(
      this.addressesFor(person, channels).map(({ channel, to }) => {
        if (channel === 'email') {
          return this.email.send({
            to,
            subject,
            html: `<p>${greeting}</p><p>${body.replace(/\n/g, '<br>')}</p><hr><p style="font-size:12px;color:#666">You are receiving this because you opted in to updates from this store. <a href="${unsubscribe}">Unsubscribe</a>.</p>`,
          });
        }
        // Every message carries a way out, on every channel — not just email.
        const text = `${greeting}\n\n${body}\n\nTo stop these updates: ${unsubscribe}`;
        return channel === 'whatsapp' ? this.whatsapp.send({ to, body: text }) : this.sms.send({ to, body: text });
      }),
    );
    return results.some((r) => r.status === 'fulfilled');
  }
}
