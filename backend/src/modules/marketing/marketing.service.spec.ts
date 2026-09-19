import { NotFoundException } from '@nestjs/common';
import { MarketingService } from './marketing.service';

const SECRET = 'a'.repeat(32);
const config = { get: (k: string) => (k === 'JWT_ACCESS_SECRET' ? SECRET : 'http://localhost:3000') } as never;
const noop = { send: async () => {} } as never;

/** Captures the where-clause the service builds, which is where consent is actually enforced. */
function prismaSpy(customers: unknown[] = []) {
  const wheres: Record<string, unknown>[] = [];
  const customer = {
    findMany: async ({ where }: { where: Record<string, unknown> }) => { wheres.push(where); return customers; },
    count: async () => 0,
    updateMany: async () => ({ count: 1 }),
  };
  const prisma = { forTenant: () => ({ customer, campaign: { create: async ({ data }: { data: unknown }) => data } }), customer } as never;
  return { prisma, wheres };
}

describe('MarketingService consent', () => {
  it('never queries beyond opted-in, non-unsubscribed customers — on every audience', async () => {
    for (const audience of ['all', 'buyers', 'prospects', 'selected'] as const) {
      const { prisma, wheres } = prismaSpy();
      const service = new MarketingService(prisma, config, noop, noop, noop);
      await service.audiencePreview('t1', audience, ['c1'], ['email']);
      expect(wheres[0]).toMatchObject({ marketingOptIn: true, unsubscribedAt: null });
    }
  });

  it('sends nothing when no one has opted in, and records the campaign as already complete', async () => {
    const { prisma } = prismaSpy([]);
    const email = { send: jest.fn() };
    const service = new MarketingService(prisma, config, email as never, noop, noop);
    const campaign = await service.send('t1', { subject: 'Hi', body: 'Sale on now', channels: ['email'], audience: 'all' });
    expect(campaign).toMatchObject({ recipientCount: 0, status: 'SENT' });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('skips a recipient with no address on any chosen channel', async () => {
    const { prisma } = prismaSpy([{ id: 'c1', name: 'No Phone', email: null, phone: null }]);
    const service = new MarketingService(prisma, config, noop, noop, noop);
    const preview = await service.audiencePreview('t1', 'all', [], ['sms']);
    expect(preview).toMatchObject({ recipients: 0, unreachable: 1 });
  });
});

describe('MarketingService unsubscribe', () => {
  const { prisma } = prismaSpy();
  const service = new MarketingService(prisma, config, noop, noop, noop);

  it('accepts its own signed token', async () => {
    await expect(service.unsubscribe('c1', service.unsubscribeToken('c1'))).resolves.toEqual({ unsubscribed: true });
  });

  it('rejects another customer\'s token, so a link cannot be replayed against someone else', async () => {
    await expect(service.unsubscribe('c2', service.unsubscribeToken('c1'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a forged token of the right length', async () => {
    await expect(service.unsubscribe('c1', 'f'.repeat(32))).rejects.toBeInstanceOf(NotFoundException);
  });
});
