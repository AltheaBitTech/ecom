import { ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';

const WEBHOOK_SECRET = 'test-webhook-secret';

function notifications() {
  return { notifyPaymentResult: jest.fn() } as never;
}

function fakeConfig() {
  return { get: (key: string) => (key === 'RAZORPAY_WEBHOOK_SECRET' ? WEBHOOK_SECRET : undefined) } as never;
}

describe('PaymentsService.verifySignature', () => {
  const service = new PaymentsService({} as never, fakeConfig(), {} as never, notifications());

  it('accepts a correctly-signed body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    expect(service.verifySignature(body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ event: 'payment.captured', amount: 999999 }));
    expect(service.verifySignature(tampered, signature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    const body = Buffer.from('{}');
    expect(service.verifySignature(body, undefined)).toBe(false);
  });
});

describe('PaymentsService.markPaid', () => {
  const paid = { id: 'p1', tenantId: 't1', orderId: 'o1', status: 'PAID' };
  const pending = { ...paid, status: 'PENDING' };

  function build(payment: typeof pending, confirm = jest.fn().mockResolvedValue({})) {
    const update = jest.fn().mockResolvedValue(paid);
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment), update },
      order: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never;
    return { service: new PaymentsService(prisma, fakeConfig(), { confirm } as never, notifications()), update, confirm };
  }

  it('marks the payment paid and confirms the order (which decrements stock)', async () => {
    const { service, update, confirm } = build(pending);
    await expect(service.markPaid('order_x', 'pay_x')).resolves.toMatchObject({ status: 'PAID' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('t1', 'o1');
  });

  it('is idempotent — a second delivery neither re-updates nor double-decrements', async () => {
    const alreadyConfirmed = jest.fn().mockRejectedValue(new ConflictException('Only pending orders can be confirmed'));
    const { service, update } = build(paid, alreadyConfirmed);
    await expect(service.markPaid('order_x', 'pay_x')).resolves.toMatchObject({ status: 'PAID' });
    expect(update).not.toHaveBeenCalled();
  });

  it('sends the payment receipt once, not again on a redelivery', async () => {
    const notify = { notifyPaymentResult: jest.fn() };
    // Same notify double across both deliveries; only the first should reach the customer.
    const build = (status: string) => new PaymentsService(
      {
        payment: { findUnique: jest.fn().mockResolvedValue({ ...paid, status }), update: jest.fn().mockResolvedValue(paid) },
        order: { findUnique: jest.fn().mockResolvedValue({ id: 'o1', customer: { email: 'shopper@example.com' } }) },
      } as never,
      fakeConfig(),
      { confirm: jest.fn().mockResolvedValue({}) } as never,
      notify as never,
    );
    await build('PENDING').markPaid('order_x', 'pay_x');
    expect(notify.notifyPaymentResult).toHaveBeenCalledTimes(1);
    await build('PAID').markPaid('order_x', 'pay_x');
    expect(notify.notifyPaymentResult).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown provider order', async () => {
    const prisma = { payment: { findUnique: jest.fn().mockResolvedValue(null) }, order: { findUnique: jest.fn() } } as never;
    const service = new PaymentsService(prisma, fakeConfig(), {} as never, notifications());
    await expect(service.markPaid('nope', 'pay_x')).resolves.toBeNull();
  });
});
