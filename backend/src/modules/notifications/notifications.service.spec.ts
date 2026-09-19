import { PERMISSIONS } from '../roles/permissions.catalog';
import { NotificationsService } from './notifications.service';

const order = { id: 'o1', status: 'PENDING', totalCents: 1000, currency: 'INR', customer: { email: 'buyer@example.com', phone: '+911234567890' } };

function user(email: string, permissions: string[], emailNotifications = true, archivedAt: Date | null = null) {
  return { id: email, email, emailNotifications, roles: [{ role: { permissions: permissions as string[], archivedAt } }] };
}

/** Prisma double backing the RBAC recipient lookup and the in-app notification writes. */
function buildTeam(users: ReturnType<typeof user>[]) {
  const sent: { to: string; subject: string; body: string }[] = [];
  const saved: { userId: string; title: string; link: string | null }[] = [];
  const email = { send: async (p: { to: string; subject: string; html: string }) => { sent.push({ to: p.to, subject: p.subject, body: p.html }); } } as never;
  const noPhone = { send: async () => {} } as never;
  const prisma = {
    user: { findMany: async () => users, findFirst: async () => users[0] },
    notification: { createMany: async ({ data }: { data: typeof saved }) => { saved.push(...data); } },
  } as never;
  return { sent, saved, service: new NotificationsService(prisma, email, noPhone, noPhone) };
}

describe('NotificationsService', () => {
  it('fans out to email and whatsapp when both are present, never throwing on channel failure', async () => {
    const calls: string[] = [];
    const email = { send: async () => { calls.push('email'); } } as never;
    const whatsapp = { send: async () => { throw new Error('down'); } } as never;
    const sms = { send: async () => { calls.push('sms-fallback'); } } as never;
    const prisma = {} as never;
    const service = new NotificationsService(prisma, email, sms, whatsapp);

    await service.notifyOrderStatusChanged(order, 'CONFIRMED');

    expect(calls).toEqual(['email', 'sms-fallback']);
  });

  it('swallows errors instead of throwing, so a caller can fire-and-forget', async () => {
    const email = { send: async () => { throw new Error('resend down'); } } as never;
    const noPhone = { send: async () => {} } as never;
    const prisma = {} as never;
    const service = new NotificationsService(prisma, email, noPhone, noPhone);

    await expect(service.notifyOrderStatusChanged({ ...order, customer: { email: 'x@example.com' } }, 'SHIPPED')).resolves.toBeUndefined();
  });

  it('sends subscription events to whoever can see billing', async () => {
    const { sent, service, saved } = buildTeam([
      user('owner@tenant.com', [PERMISSIONS.BILLING_VIEW, PERMISSIONS.ORDERS_VIEW]),
      user('packer@tenant.com', [PERMISSIONS.ORDERS_VIEW]),
    ]);

    await service.notifySubscriptionEvent({ id: 't1', name: 'Acme' }, { plan: { name: 'Pro' } }, 'created');

    expect(sent.map((s) => s.to)).toEqual(['owner@tenant.com']);
    expect(saved.map((n) => n.userId)).toEqual(['owner@tenant.com']);
  });

  describe('routing: who hears about what', () => {
    const withEmailOnly = { ...order, customer: { email: 'buyer@example.com' } };
    const team = () => [
      user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.BILLING_VIEW]),
      user('packer@tenant.com', [PERMISSIONS.ORDERS_VIEW]),
      user('nosy@tenant.com', [PERMISSIONS.CATALOG_PRODUCTS_VIEW]),
    ];

    it('tells everyone who can see orders — not the shopper, not unrelated staff', async () => {
      const { sent, saved, service } = buildTeam(team());
      await service.notifyOrderPlaced('t1', withEmailOnly);
      expect(sent.map((s) => s.to)).toEqual(['owner@tenant.com', 'packer@tenant.com']);
      expect(saved.map((n) => n.userId)).toEqual(['owner@tenant.com', 'packer@tenant.com']);
    });

    it('deep-links the in-app notification to the order it is about', async () => {
      const { saved, service } = buildTeam(team());
      await service.notifyOrderPlaced('t1', withEmailOnly);
      expect(saved[0].link).toBe(`/admin/orders/${withEmailOnly.id}`);
    });

    it('still writes the in-app copy for someone who muted email', async () => {
      const { sent, saved, service } = buildTeam([
        user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW]),
        user('muted@tenant.com', [PERMISSIONS.ORDERS_VIEW], false),
      ]);
      await service.notifyOrderPlaced('t1', withEmailOnly);
      expect(sent.map((s) => s.to)).toEqual(['owner@tenant.com']);
      expect(saved.map((n) => n.userId)).toEqual(['owner@tenant.com', 'muted@tenant.com']);
    });

    it('falls back to the first user when nobody holds the permission', async () => {
      const { sent, service } = buildTeam([user('solo@tenant.com', [])]);
      await service.notifyOrderPlaced('t1', withEmailOnly);
      expect(sent.map((s) => s.to)).toEqual(['solo@tenant.com']);
    });

    it('ignores permissions granted only by an archived role', async () => {
      const archived = user('ghost@tenant.com', [PERMISSIONS.ORDERS_VIEW], true, new Date());
      const { sent, service } = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW]), archived]);
      await service.notifyOrderPlaced('t1', withEmailOnly);
      expect(sent.map((s) => s.to)).toEqual(['owner@tenant.com']);
    });

    it('tells both sides about a payment, and says whether it succeeded', async () => {
      const { sent, service } = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW])]);
      await service.notifyPaymentResult('t1', withEmailOnly, true);
      expect(sent.map((s) => s.to)).toEqual(['buyer@example.com', 'owner@tenant.com']);
      expect(sent.every((s) => /payment received/i.test(s.subject))).toBe(true);

      const failed = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW])]);
      await failed.service.notifyPaymentResult('t1', withEmailOnly, false);
      expect(failed.sent.map((s) => s.to)).toEqual(['buyer@example.com', 'owner@tenant.com']);
      expect(failed.sent.every((s) => /payment failed/i.test(s.subject))).toBe(true);
    });

    it('routes a return request to the merchant and its decision back to the shopper', async () => {
      const requested = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW])]);
      await requested.service.notifyReturnRequested('t1', withEmailOnly, 'Arrived damaged');
      expect(requested.sent.map((s) => s.to)).toEqual(['owner@tenant.com']);
      expect(requested.sent[0].body).toContain('Arrived damaged');

      // A shopper-only message writes no in-app row — shoppers have no dashboard.
      const resolved = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW])]);
      await resolved.service.notifyReturnResolved(withEmailOnly, 'REFUNDED', 2500);
      expect(resolved.sent.map((s) => s.to)).toEqual(['buyer@example.com']);
      expect(resolved.sent[0].body).toContain('INR 25.00');
      expect(resolved.saved).toEqual([]);
    });

    it('carries the cancellation reason into the shopper\'s message', async () => {
      const { sent, service } = buildTeam([user('owner@tenant.com', [PERMISSIONS.ORDERS_VIEW])]);
      await service.notifyOrderStatusChanged(withEmailOnly, 'CANCELLED', 'Reason: Out of stock');
      expect(sent[0].body).toContain('Out of stock');
    });
  });
});

describe('NotificationsService — stock, review, review-of-tenant, reset', () => {
  const owner = user('owner@x.com', [PERMISSIONS.INVENTORY_STOCK_VIEW, PERMISSIONS.CATALOG_PRODUCTS_MANAGE, PERMISSIONS.TENANT_SETTINGS_UPDATE]);
  function build() {
    const team = buildTeam([owner]);
    const prisma = {
      user: { findMany: async () => [owner], findFirst: async () => owner },
      notification: { createMany: async ({ data }: { data: { title: string }[] }) => { team.saved.push(...(data as never[])); } },
      product: { findMany: async () => [{ id: 'p1', name: 'Bread' }] },
    } as never;
    const email = { send: async (p: { to: string; subject: string; html: string }) => { team.sent.push({ to: p.to, subject: p.subject, body: p.html }); } } as never;
    const noop = { send: async () => {} } as never;
    return { ...team, service: new NotificationsService(prisma, email, noop, noop) };
  }
  const change = (before: number, after: number, threshold = 5) => [{ productId: 'p1', before, after, threshold }];

  it('alerts once when stock crosses into low, and again when it runs out', async () => {
    const { service, saved } = build();
    await service.notifyStockChanges('t1', change(9, 4));
    await service.notifyStockChanges('t1', change(4, 3)); // already low: no repeat
    await service.notifyStockChanges('t1', change(3, 0));
    expect(saved.map((n) => n.title)).toEqual(['Low stock: Bread', 'Out of stock: Bread']);
  });

  it('stays quiet above the threshold, and without a threshold only alerts at zero', async () => {
    const { service, saved } = build();
    await service.notifyStockChanges('t1', change(20, 10));
    await service.notifyStockChanges('t1', change(5, 2, 0));
    expect(saved).toHaveLength(0);
    await service.notifyStockChanges('t1', change(2, 0, 0));
    expect(saved.map((n) => n.title)).toEqual(['Out of stock: Bread']);
  });

  it('tells the owner about review moderation and workspace approval', async () => {
    const { service, saved } = build();
    await service.notifyReviewSubmitted('t1', 5);
    await service.notifyTenantReview('t1', 'approved');
    expect(saved.map((n) => n.title)).toEqual(['New review to moderate', 'Your workspace is approved']);
  });

  it('emails a reset link and welcome message without throwing when email is down', async () => {
    const { service, sent } = build();
    await service.notifyPasswordReset('a@b.com', 'Acme', 'https://app/reset-password?token=abc');
    expect(sent[0]).toMatchObject({ to: 'a@b.com', subject: 'Reset your password' });
    expect(sent[0].body).toContain('https://app/reset-password?token=abc');
    const failing = new NotificationsService({} as never, { send: async () => { throw new Error('down'); } } as never, {} as never, {} as never);
    await expect(failing.notifyPasswordReset('a@b.com', 'Acme', 'u')).resolves.toBeUndefined();
    await expect(failing.notifyWelcome('a@b.com', 'Acme')).resolves.toBeUndefined();
  });
});

