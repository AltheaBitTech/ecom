import { ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EnvConfig } from '../../common/config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';

export interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string } };
  };
}

@Injectable()
export class PaymentsService {
  private readonly client: Razorpay | null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
  ) {
    const keyId = this.config.get('RAZORPAY_KEY_ID', { infer: true });
    const keySecret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    // Deliberately not constructed if unconfigured — every method below fails loudly
    // instead, rather than the app silently booting with a broken payments module.
    this.client = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  private requireClient(): Razorpay {
    if (!this.client) {
      throw new InternalServerErrorException('Payments are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
    }
    return this.client;
  }

  list(tenantId: string) {
    return this.prisma
      .forTenant(tenantId)
      .payment.findMany({ include: { order: { include: { customer: true } } }, orderBy: { createdAt: 'desc' } });
  }

  /** Creates a Razorpay order for an existing internal Order and stores the Payment row. */
  async createPaymentForOrder(tenantId: string, orderId: string) {
    const razorpay = this.requireClient();
    const scoped = this.prisma.forTenant(tenantId);
    const order = await scoped.order.findFirst({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.payment) throw new ConflictException('This order already has a payment');

    const rzpOrder = await razorpay.orders.create({
      amount: order.totalCents,
      currency: order.currency,
      receipt: order.id,
      notes: { tenantId, orderId: order.id },
    });

    const payment = await scoped.payment.create({
      data: {
        tenantId,
        orderId: order.id,
        provider: 'razorpay',
        providerOrderId: rzpOrder.id,
        amountCents: order.totalCents,
        currency: order.currency,
      },
    });

    return { payment, razorpayKeyId: this.config.get('RAZORPAY_KEY_ID', { infer: true }), razorpayOrderId: rzpOrder.id };
  }

  /** Verifies the webhook signature over the raw request body — never trust an unverified payload. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * The single place a payment becomes PAID — the webhook and the browser's post-checkout
   * verify call both land here, so whichever arrives first does the work and the other is a
   * no-op. Confirming the order is what actually reserves stock; a shortage (or an order the
   * merchant already moved on) leaves the order where it is instead of failing money that has
   * already been captured.
   */
  async markPaid(providerOrderId: string, providerPaymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId } });
    if (!payment) return null;

    const updated =
      payment.status === 'PAID'
        ? payment
        : await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', providerPaymentId } });

    // A redelivery finds the payment already PAID and must not re-send the receipt.
    const firstTime = payment.status !== 'PAID';
    try {
      await this.orders.confirm(payment.tenantId, payment.orderId);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      // Already confirmed (a duplicate delivery) or out of stock — both are the merchant's to
      // resolve from the order screen, neither should fail a captured payment.
      this.logger.warn(`Order ${payment.orderId} paid but not confirmed: ${error.message}`);
    }
    if (firstTime) await this.notifyOutcome(payment.tenantId, payment.orderId, true);
    return updated;
  }

  /** Loads the order with its customer so the notification has someone to reach. */
  private async notifyOutcome(tenantId: string, orderId: string, paid: boolean) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (order) void this.notifications.notifyPaymentResult(tenantId, order, paid);
  }

  /**
   * Applies a verified webhook event. Looked up by providerOrderId (globally unique) rather
   * than through forTenant, since the webhook itself carries no tenant context — safe only
   * because the caller has already verified the signature before reaching here.
   */
  async applyWebhookEvent(event: RazorpayWebhookEvent): Promise<void> {
    const entity = event.payload.payment?.entity;
    if (!entity) return;

    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId: entity.order_id } });
    if (!payment) return;

    if (event.event === 'payment.captured') {
      await this.markPaid(entity.order_id, entity.id);
    } else if (event.event === 'payment.failed') {
      const { count } = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { notIn: ['PAID', 'REFUNDED'] } },
        data: { status: 'FAILED', providerPaymentId: entity.id },
      });
      // count === 0 means it was already PAID/REFUNDED — a late failure event for a payment
      // that ultimately succeeded, so don't alarm anyone about it.
      if (count > 0) await this.notifyOutcome(payment.tenantId, payment.orderId, false);
    }
  }
}
