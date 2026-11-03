import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import type { Principal } from '../../common/auth/principal';
import { isCustomer } from '../../common/auth/principal';
import { SecretBox } from '../../common/crypto/secret-box';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { canTransition, OrdersService, type OrderView } from '../orders/orders.service';

import type { UpsertPaymentAccountDto, VerifyPaymentDto } from './dto/payments.dto';
import { PaymentGatewayRegistry } from './gateways/gateway.registry';
import type { GatewayCredentials } from './gateways/payment-gateway';

/** What the storefront needs to open the gateway checkout. Never carries secrets. */
export interface PaymentIntentView {
  provider: string;
  public_key: string | null;
  provider_order_id: string;
  amount_cents: number;
  currency: string;
  order_id: string;
  /** Manual/COD stores have no online checkout; the client just confirms. */
  requires_gateway: boolean;
}

/** Non-secret view of a tenant's payment configuration. */
export interface PaymentAccountView {
  provider: string;
  enabled: boolean;
  public_key: string | null;
  configured: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  supported_providers: string[];
}

interface LoadedAccount {
  account: { provider: string; enabled: boolean; publicKey: string | null };
  credentials: GatewayCredentials;
}

/**
 * Payments. Coordinates the pluggable gateway, the per-tenant (encrypted)
 * credentials, and the payment ledger. Capturing a payment — and ONLY that — is
 * what moves an order from PENDING to PAID, whether the confirmation arrives via
 * the client callback or the gateway webhook. Both paths are idempotent, keyed on
 * the payment intent, so a double-submit or a webhook race can't pay twice.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBox,
    private readonly gateways: PaymentGatewayRegistry,
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
  ) {}

  // --- Storefront ------------------------------------------------------------
  /** Create a gateway intent for an order the shopper is allowed to pay. */
  async createIntent(
    tenantId: string,
    orderId: string,
    principal?: Principal,
    email?: string,
  ): Promise<PaymentIntentView> {
    // Reuses the exact shopper-ownership rules (owner customer / matching guest
    // email); throws not_found otherwise.
    const order = await this.orders.getForShopper(tenantId, orderId, principal, email);
    if (order.status !== OrderStatus.PENDING) {
      throw AppException.validation('This order is not awaiting payment.');
    }

    const { account, credentials } = await this.loadAccount(tenantId);
    const gateway = this.gateways.get(account.provider);
    if (!gateway.isConfigured(credentials)) {
      throw AppException.validation('This store has not finished setting up payments.');
    }

    const { providerOrderId } = await gateway.createOrder({
      credentials,
      amountCents: order.total_cents,
      currency: order.currency,
      receipt: order.number,
      notes: { order_id: order.id },
    });

    await this.prisma.forTenant(tenantId, (tx) =>
      tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: account.provider,
          status: PaymentStatus.CREATED,
          amountCents: order.total_cents,
          currency: order.currency,
          providerOrderId,
        },
      }),
    );

    return {
      provider: account.provider,
      public_key: credentials.publicKey,
      provider_order_id: providerOrderId,
      amount_cents: order.total_cents,
      currency: order.currency,
      order_id: order.id,
      requires_gateway: account.provider !== 'manual',
    };
  }

  /** Verify a client-side gateway callback and, if valid, mark the order PAID. */
  async verify(
    tenantId: string,
    orderId: string,
    dto: VerifyPaymentDto,
    principal?: Principal,
    email?: string,
  ): Promise<OrderView> {
    await this.orders.getForShopper(tenantId, orderId, principal, email);

    const { account, credentials } = await this.loadAccount(tenantId);
    const gateway = this.gateways.get(account.provider);
    const valid = gateway.verifyCallback(
      {
        providerOrderId: dto.provider_order_id,
        providerPaymentId: dto.provider_payment_id,
        signature: dto.signature,
      },
      credentials,
    );
    if (!valid) {
      throw new AppException('payment_verification_failed', 'Payment could not be verified.', 402);
    }

    await this.applyCapture(tenantId, orderId, dto.provider_order_id, dto.provider_payment_id);

    await this.audit.record({
      tenantId,
      actorKind: principal && isCustomer(principal) ? 'customer' : 'system',
      actorId: principal && isCustomer(principal) ? principal.customerId : null,
      action: 'payment.captured',
      target: orderId,
      method: 'POST',
      route: '/storefront/:tenantId/orders/:id/pay/verify',
      statusCode: 200,
      metadata: { provider: account.provider, provider_payment_id: dto.provider_payment_id },
    });
    return this.orders.getAdmin(tenantId, orderId);
  }

  /**
   * Handle a gateway webhook. The signature is verified against the tenant's
   * webhook secret; a valid `payment.captured` marks the order PAID idempotently.
   * Any unverifiable body is rejected so a forged webhook can't confirm an order.
   */
  async handleWebhook(
    tenantId: string,
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const { account, credentials } = await this.loadAccount(tenantId);
    const gateway = this.gateways.get(account.provider);
    const event = gateway.verifyWebhook(rawBody, signature, credentials);
    if (!event) {
      throw AppException.unauthenticated('Webhook signature verification failed.');
    }

    if (event.type === 'payment.captured' && event.providerOrderId && event.providerPaymentId) {
      try {
        await this.applyCapture(tenantId, null, event.providerOrderId, event.providerPaymentId);
        await this.audit.record({
          tenantId,
          actorKind: 'system',
          action: 'payment.captured',
          method: 'POST',
          route: '/storefront/:tenantId/payments/webhook',
          statusCode: 200,
          metadata: { provider: account.provider, provider_payment_id: event.providerPaymentId, via: 'webhook' },
        });
      } catch (err) {
        // Still 200 the webhook so the gateway doesn't retry a benign no-op.
        this.logger.warn(`Webhook capture for ${event.providerOrderId} was a no-op: ${(err as Error).message}`);
      }
    }
    return { received: true };
  }

  // --- Admin -----------------------------------------------------------------
  async getAccount(tenantId: string): Promise<PaymentAccountView> {
    const account = await this.prisma.forTenant(tenantId, (tx) =>
      tx.paymentAccount.findUnique({ where: { tenantId } }),
    );
    const provider = account?.provider ?? 'manual';
    return {
      provider,
      enabled: account?.enabled ?? false,
      public_key: account?.publicKey ?? null,
      configured: this.isProviderReady(provider, account),
      has_secret_key: Boolean(account?.secretKeyEnc),
      has_webhook_secret: Boolean(account?.webhookSecretEnc),
      supported_providers: this.gateways.supported(),
    };
  }

  /** Connect or update the tenant's payment account. Secrets are write-only. */
  async upsertAccount(
    tenantId: string,
    dto: UpsertPaymentAccountDto,
    actorUserId: string,
  ): Promise<PaymentAccountView> {
    if (!this.gateways.isSupported(dto.provider)) {
      throw AppException.validation(`Unsupported payment provider "${dto.provider}".`);
    }

    const existing = await this.prisma.forTenant(tenantId, (tx) =>
      tx.paymentAccount.findUnique({ where: { tenantId } }),
    );
    const switchingProvider = existing?.provider !== dto.provider;

    // A newly-connected Razorpay account must arrive with its key pair; on update
    // a secret may be omitted to keep the stored one.
    if (dto.provider === 'razorpay') {
      const willHavePublic = dto.public_key ?? (switchingProvider ? null : existing?.publicKey);
      const willHaveSecret = dto.secret_key ?? (switchingProvider ? null : existing?.secretKeyEnc);
      if (!willHavePublic || !willHaveSecret) {
        throw AppException.validation('Razorpay requires both a public key id and a secret key.');
      }
    }

    const publicKey = dto.public_key ?? (switchingProvider ? null : existing?.publicKey ?? null);
    const secretKeyEnc =
      dto.secret_key !== undefined
        ? this.secrets.encrypt(dto.secret_key)
        : switchingProvider
          ? null
          : existing?.secretKeyEnc ?? null;
    const webhookSecretEnc =
      dto.webhook_secret !== undefined
        ? this.secrets.encrypt(dto.webhook_secret)
        : switchingProvider
          ? null
          : existing?.webhookSecretEnc ?? null;
    const enabled = dto.enabled ?? existing?.enabled ?? true;

    const create: Prisma.PaymentAccountUncheckedCreateInput = {
      tenantId,
      provider: dto.provider,
      enabled,
      publicKey,
      secretKeyEnc,
      webhookSecretEnc,
    };

    await this.prisma.forTenant(tenantId, (tx) =>
      tx.paymentAccount.upsert({
        where: { tenantId },
        create,
        update: { provider: dto.provider, enabled, publicKey, secretKeyEnc, webhookSecretEnc },
      }),
    );

    await this.audit.record({
      tenantId,
      actorKind: 'staff',
      actorId: actorUserId,
      action: 'payment_account.updated',
      target: tenantId,
      method: 'PUT',
      route: '/tenants/:tenantId/payment-account',
      statusCode: 200,
      metadata: { provider: dto.provider, enabled },
    });
    return this.getAccount(tenantId);
  }

  // --- Internals -------------------------------------------------------------
  /**
   * Mark the intent's payment CAPTURED and move its order to PAID, atomically and
   * idempotently. `orderId` is known on the client path and null on the webhook
   * path (resolved from the payment). Re-applying a captured payment is a no-op.
   */
  private async applyCapture(
    tenantId: string,
    orderId: string | null,
    providerOrderId: string,
    providerPaymentId: string,
  ): Promise<void> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { providerOrderId, ...(orderId ? { orderId } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      if (!payment) {
        throw AppException.notFound('No payment was started for this order.');
      }

      if (payment.status !== PaymentStatus.CAPTURED) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.CAPTURED, providerPaymentId },
        });
      }

      const order = await tx.order.findFirst({ where: { id: payment.orderId } });
      if (!order) throw AppException.notFound('Order not found');
      if (order.status === OrderStatus.PENDING) {
        if (!canTransition(order.status, OrderStatus.PAID)) {
          throw AppException.validation(`Cannot move an order from ${order.status} to PAID`);
        }
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });
      }
    });
  }

  /** Load a tenant's account with its secrets decrypted for gateway use. */
  private async loadAccount(tenantId: string): Promise<LoadedAccount> {
    const account = await this.prisma.forTenant(tenantId, (tx) =>
      tx.paymentAccount.findUnique({ where: { tenantId } }),
    );

    // No account yet → default to the manual/COD provider so orders can still be
    // placed. It has no credentials and no online capture.
    if (!account) {
      return {
        account: { provider: 'manual', enabled: true, publicKey: null },
        credentials: { publicKey: null, secretKey: null, webhookSecret: null },
      };
    }
    if (!account.enabled) {
      throw AppException.validation('Online payments are currently disabled for this store.');
    }

    return {
      account: { provider: account.provider, enabled: account.enabled, publicKey: account.publicKey },
      credentials: {
        publicKey: account.publicKey,
        secretKey: account.secretKeyEnc ? this.secrets.decrypt(account.secretKeyEnc) : null,
        webhookSecret: account.webhookSecretEnc ? this.secrets.decrypt(account.webhookSecretEnc) : null,
      },
    };
  }

  private isProviderReady(
    provider: string,
    account: { publicKey: string | null; secretKeyEnc: string | null } | null,
  ): boolean {
    if (provider === 'manual') return true;
    if (provider === 'razorpay') return Boolean(account?.publicKey && account?.secretKeyEnc);
    return false;
  }
}
