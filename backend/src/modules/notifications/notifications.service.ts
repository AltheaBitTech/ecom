import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';

type NotifiableCustomer = { email?: string | null; phone?: string | null; name?: string | null };
type NotifiableOrder = { id: string; tenantId?: string; status: string; totalCents: number; currency: string; customer: NotifiableCustomer };
type NotifiableTenant = { id: string; name: string };
type NotifiableSubscription = { plan: { name: string } };
type NotifiableInvoice = { number: string; totalCents: number; currency: string };
type SubscriptionEventKind = 'created' | 'upgraded' | 'payment_succeeded' | 'payment_failed' | 'cancelled';
type ReturnDecision = 'APPROVED' | 'REJECTED' | 'REFUNDED';
type StockChange = { productId: string; before: number; after: number; threshold: number };
export type TenantReviewKind = 'approved' | 'rejected' | 'revision_requested';

/** 'low' = at/below a positive reorder threshold, 'out' = nothing left. */
function stockLevel(quantity: number, threshold: number) {
  return quantity <= 0 ? 'out' : threshold > 0 && quantity <= threshold ? 'low' : 'ok';
}

/** Short order reference for message bodies — the full UUID is unreadable in an SMS. */
function ref(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function money(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

/**
 * Composes short, plain-language notifications and fires whichever channels the recipient has
 * contact details for. Every public method swallows its own errors (logs and returns) so a
 * notification failure never fails the order/subscription/invoice operation that triggered it —
 * callers can fire-and-forget without their own try/catch.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Who on the team should hear about this. There is still no "owner" field on Tenant/User, so
   * rather than invent one, the audience is derived from RBAC: every active user whose roles
   * grant the permission that governs the thing being announced. An order alert reaches whoever
   * can see orders; a billing alert reaches whoever can see billing.
   *
   * Falls back to the earliest active user when nobody holds the permission, so a tenant whose
   * roles have been pared back still hears about its own orders.
   */
  private async adminRecipients(tenantId: string, permission: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, email: true, emailNotifications: true, roles: { select: { role: { select: { permissions: true, archivedAt: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const permitted = users.filter((u) => u.roles.some((r) => !r.role.archivedAt && r.role.permissions.includes(permission)));
    return permitted.length ? permitted : users.slice(0, 1);
  }

  /**
   * Fire-and-forget team alert: an in-app notification for everyone who should see it, plus an
   * emailed copy for those who haven't opted out. In-app is always written — it costs the
   * recipient nothing until they open the bell — so muting email never means missing the event.
   */
  async notifyAdmin(tenantId: string, subject: string, text: string, options: { permission?: string; link?: string } = {}): Promise<void> {
    try {
      const recipients = await this.adminRecipients(tenantId, options.permission ?? PERMISSIONS.ORDERS_VIEW);
      if (!recipients.length) return;

      await this.prisma.notification.createMany({
        data: recipients.map((u) => ({ tenantId, userId: u.id, title: subject, body: text, link: options.link ?? null })),
      });

      await Promise.all(recipients.filter((u) => u.emailNotifications).map((u) => this.fanOut({ email: u.email }, subject, text)));
    } catch (err) {
      this.logger.warn(`notifyAdmin failed: ${String(err)}`);
    }
  }

  private async fanOut(to: { email?: string | null; phone?: string | null }, subject: string, text: string) {
    const html = `<p>${text}</p>`;
    const tasks: Promise<unknown>[] = [];
    if (to.email) tasks.push(this.email.send({ to: to.email, subject, html }));
    if (to.phone) {
      // ponytail: WhatsApp preferred over plain SMS (richer, same Twilio account) — falls back
      // to SMS only when WhatsApp isn't configured/fails, not a real per-recipient preference.
      const phone = to.phone;
      tasks.push(this.whatsapp.send({ to: phone, body: text }).catch(() => this.sms.send({ to: phone, body: text })));
    }
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === 'rejected') this.logger.warn(`Notification channel failed: ${String(r.reason)}`);
    }
  }

  async notifyOrderStatusChanged(order: NotifiableOrder, status: string, note?: string | null): Promise<void> {
    try {
      const subject = `Order ${ref(order.id)}: ${status.toLowerCase()}`;
      const text = `Your order ${ref(order.id)} (${money(order.totalCents, order.currency)}) is now ${status.toLowerCase()}.${note ? ` ${note}` : ''}`;
      await this.fanOut(order.customer, subject, text);
    } catch (err) {
      this.logger.warn(`notifyOrderStatusChanged failed: ${String(err)}`);
    }
  }

  /** A new order landed — the merchant's cue to start packing. */
  async notifyOrderPlaced(tenantId: string, order: NotifiableOrder): Promise<void> {
    await this.notifyAdmin(
      tenantId,
      `New order ${ref(order.id)}`,
      `${order.customer.name ?? 'A customer'} placed order ${ref(order.id)} for ${money(order.totalCents, order.currency)}. Awaiting payment.`,
      { link: `/admin/orders/${order.id}` },
    );
  }

  /** Payment outcome — the customer needs the receipt, the merchant needs to know it cleared. */
  async notifyPaymentResult(tenantId: string, order: NotifiableOrder, paid: boolean): Promise<void> {
    try {
      const amount = money(order.totalCents, order.currency);
      await this.fanOut(
        order.customer,
        paid ? `Payment received for order ${ref(order.id)}` : `Payment failed for order ${ref(order.id)}`,
        paid
          ? `We've received your payment of ${amount} for order ${ref(order.id)}. We'll let you know as soon as it ships.`
          : `Your payment of ${amount} for order ${ref(order.id)} didn't go through. Your bag is saved — you can try again.`,
      );
    } catch (err) {
      this.logger.warn(`notifyPaymentResult failed: ${String(err)}`);
    }
    await this.notifyAdmin(
      tenantId,
      paid ? `Payment received: ${ref(order.id)}` : `Payment failed: ${ref(order.id)}`,
      paid
        ? `Order ${ref(order.id)} is paid (${money(order.totalCents, order.currency)}) and confirmed.`
        : `Payment failed on order ${ref(order.id)} (${money(order.totalCents, order.currency)}). No stock was deducted.`,
      { link: `/admin/orders/${order.id}` },
    );
  }

  /** A customer asked to send something back — needs a human decision. */
  async notifyReturnRequested(tenantId: string, order: NotifiableOrder, reason: string): Promise<void> {
    await this.notifyAdmin(
      tenantId,
      `Return requested: ${ref(order.id)}`,
      `${order.customer.name ?? 'A customer'} requested a return on order ${ref(order.id)}. Reason: ${reason}`,
      { link: `/admin/orders/${order.id}` },
    );
  }

  async notifyReturnResolved(order: NotifiableOrder, decision: ReturnDecision, refundCents?: number | null, adminNote?: string | null): Promise<void> {
    try {
      const messages: Record<ReturnDecision, string> = {
        APPROVED: `Your return request for order ${ref(order.id)} has been approved. We'll be in touch about sending the item back.`,
        REJECTED: `Your return request for order ${ref(order.id)} wasn't approved.`,
        REFUNDED: `A refund of ${money(refundCents ?? order.totalCents, order.currency)} for order ${ref(order.id)} has been issued. It can take a few working days to reach your account.`,
      };
      await this.fanOut(order.customer, `Return update: order ${ref(order.id)}`, `${messages[decision]}${adminNote ? ` ${adminNote}` : ''}`);
    } catch (err) {
      this.logger.warn(`notifyReturnResolved failed: ${String(err)}`);
    }
  }

  /** Audience: whoever can see billing, see adminRecipients(). */
  async notifySubscriptionEvent(tenant: NotifiableTenant, subscription: NotifiableSubscription, kind: SubscriptionEventKind): Promise<void> {
    try {
      const messages: Record<SubscriptionEventKind, string> = {
        created: `Your ${tenant.name} subscription to the ${subscription.plan.name} plan is now active.`,
        upgraded: `Your ${tenant.name} subscription has been changed to the ${subscription.plan.name} plan.`,
        payment_succeeded: `Payment received — your ${subscription.plan.name} plan renewal for ${tenant.name} is confirmed.`,
        payment_failed: `We couldn't process payment for your ${subscription.plan.name} plan (${tenant.name}). Please update your payment method.`,
        cancelled: `Your ${tenant.name} subscription to the ${subscription.plan.name} plan has been cancelled.`,
      };
      await this.notifyAdmin(tenant.id, `Subscription update: ${kind.replace('_', ' ')}`, messages[kind], {
        permission: PERMISSIONS.BILLING_VIEW,
        link: '/admin/settings',
      });
    } catch (err) {
      this.logger.warn(`notifySubscriptionEvent failed: ${String(err)}`);
    }
  }

  async notifyInvoiceReady(order: NotifiableOrder, invoice: NotifiableInvoice): Promise<void> {
    try {
      const text = `Invoice ${invoice.number} (${money(invoice.totalCents, invoice.currency)}) for your order is ready.`;
      await this.fanOut(order.customer, `Invoice ${invoice.number} ready`, text);
    } catch (err) {
      this.logger.warn(`notifyInvoiceReady failed: ${String(err)}`);
    }
  }

  /** Welcome email for a brand-new workspace owner (password or OAuth signup). */
  async notifyWelcome(email: string, businessName: string): Promise<void> {
    await this.fanOut(
      { email },
      'Welcome to Stallwart',
      `Your workspace "${businessName}" is ready. Next steps: add your products and stock, set up your storefront, and add your GST details in Settings.`,
    );
  }

  /** Password reset link. Sent to the account's own address only; the link carries a short-lived signed token. */
  async notifyPasswordReset(email: string, workspaceName: string, url: string): Promise<void> {
    try {
      await this.email.send({
        to: email,
        subject: 'Reset your password',
        html: `<p>We received a request to reset your password for <b>${workspaceName}</b>.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 30 minutes and works once. If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
      });
    } catch (err) {
      this.logger.warn(`notifyPasswordReset failed: ${String(err)}`);
    }
  }

  /** Owner-facing result of the platform's review of their workspace. */
  async notifyTenantReview(tenantId: string, kind: TenantReviewKind): Promise<void> {
    const messages: Record<TenantReviewKind, [string, string]> = {
      approved: ['Your workspace is approved', 'Good news — your workspace has been approved and your storefront can now go live.'],
      rejected: ['Your workspace was not approved', 'We were unable to approve your workspace. Please contact support if you think this is a mistake.'],
      revision_requested: ['Changes needed for your workspace', 'We need a few changes before we can approve your workspace. Please review your business and tax details in Settings.'],
    };
    const [subject, text] = messages[kind];
    await this.notifyAdmin(tenantId, subject, text, { permission: PERMISSIONS.TENANT_SETTINGS_UPDATE, link: '/admin/settings' });
  }

  /**
   * Stock alerts for the team. Fires once when a product crosses into "low" (at or below its
   * reorder threshold) or "out" — not on every sale after that, so it can't spam.
   */
  async notifyStockChanges(tenantId: string, changes: StockChange[]): Promise<void> {
    try {
      const crossed = changes.filter((c) => {
        const now = stockLevel(c.after, c.threshold);
        return now !== 'ok' && now !== stockLevel(c.before, c.threshold);
      });
      if (!crossed.length) return;
      const products = await this.prisma.product.findMany({ where: { tenantId, id: { in: crossed.map((c) => c.productId) } }, select: { id: true, name: true } });
      const names = new Map(products.map((p) => [p.id, p.name]));
      for (const c of crossed) {
        const name = names.get(c.productId) ?? 'A product';
        const out = stockLevel(c.after, c.threshold) === 'out';
        await this.notifyAdmin(
          tenantId,
          out ? `Out of stock: ${name}` : `Low stock: ${name}`,
          out ? `${name} is out of stock. Restock it to keep selling.` : `${name} is down to ${c.after} (reorder level ${c.threshold}).`,
          { permission: PERMISSIONS.INVENTORY_STOCK_VIEW, link: '/admin/inventory' },
        );
      }
    } catch (err) {
      this.logger.warn(`notifyStockChanges failed: ${String(err)}`);
    }
  }

  /** A shopper's review is waiting in the moderation queue. */
  async notifyReviewSubmitted(tenantId: string, rating: number): Promise<void> {
    await this.notifyAdmin(tenantId, 'New review to moderate', `A new ${rating}-star review is waiting for your approval.`, {
      permission: PERMISSIONS.CATALOG_PRODUCTS_MANAGE,
      link: '/admin/storefront',
    });
  }
}
