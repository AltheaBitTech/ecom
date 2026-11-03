import { Injectable } from '@nestjs/common';

import type {
  CreateOrderParams,
  GatewayCredentials,
  PaymentGateway,
  WebhookEvent,
} from './payment-gateway';

/**
 * The "no online gateway" provider — cash on delivery / pay-on-invoice / manual
 * bank transfer. There is no external API and no client-side capture: the order
 * is placed and stays PENDING until a staff member marks it PAID from the admin.
 * This is the default so a store can transact the moment it's provisioned, before
 * any real gateway is connected.
 */
@Injectable()
export class ManualGateway implements PaymentGateway {
  readonly provider = 'manual';

  isConfigured(): boolean {
    return true;
  }

  createOrder(params: CreateOrderParams): Promise<{ providerOrderId: string }> {
    // Synthetic id so the ledger has a stable reference; no money is moved here.
    return Promise.resolve({ providerOrderId: `manual_${params.receipt}` });
  }

  verifyCallback(): boolean {
    // Manual payments are never captured by a client callback.
    return false;
  }

  verifyWebhook(
    _rawBody: string,
    _signature: string | undefined,
    _credentials: GatewayCredentials,
  ): WebhookEvent | null {
    return null;
  }
}
