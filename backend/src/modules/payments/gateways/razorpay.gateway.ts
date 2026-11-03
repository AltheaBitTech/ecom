import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SecretBox } from '../../../common/crypto/secret-box';
import { AppException } from '../../../common/errors/app-exception';

import type {
  CreateOrderParams,
  GatewayCredentials,
  PaymentCallback,
  PaymentGateway,
  WebhookEvent,
} from './payment-gateway';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Razorpay adapter. Talks to the Orders API over HTTPS with the tenant's own
 * key pair (HTTP Basic keyId:keySecret) and verifies both the client callback
 * and webhooks with HMAC-SHA256 — no SDK, no ambient credentials.
 *
 * Callback signature:  HMAC(order_id + "|" + payment_id, key_secret)
 * Webhook signature:   HMAC(raw_request_body, webhook_secret)  [X-Razorpay-Signature]
 */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay';
  private readonly logger = new Logger(RazorpayGateway.name);

  isConfigured(credentials: GatewayCredentials): boolean {
    return Boolean(credentials.publicKey && credentials.secretKey);
  }

  async createOrder(params: CreateOrderParams): Promise<{ providerOrderId: string }> {
    const { publicKey, secretKey } = params.credentials;
    if (!publicKey || !secretKey) {
      throw AppException.validation('The store has not finished connecting Razorpay.');
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    let res: Response;
    try {
      res = await fetch(`${RAZORPAY_API}/orders`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: params.amountCents, // Razorpay amount is in the smallest unit
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes ?? {},
        }),
      });
    } catch (err) {
      this.logger.error(`Razorpay order create failed: ${(err as Error).message}`);
      throw AppException.conflict('payment_gateway_unreachable', 'Could not reach the payment gateway.');
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
    if (!res.ok || !body.id) {
      this.logger.error(`Razorpay order create rejected (${res.status}): ${JSON.stringify(body.error ?? body)}`);
      throw AppException.conflict(
        'payment_gateway_error',
        body.error?.description ?? 'The payment gateway rejected the order.',
      );
    }
    return { providerOrderId: body.id };
  }

  verifyCallback(callback: PaymentCallback, credentials: GatewayCredentials): boolean {
    if (!credentials.secretKey) return false;
    const expected = createHmac('sha256', credentials.secretKey)
      .update(`${callback.providerOrderId}|${callback.providerPaymentId}`)
      .digest('hex');
    return SecretBox.safeEqual(expected, callback.signature);
  }

  verifyWebhook(
    rawBody: string,
    signature: string | undefined,
    credentials: GatewayCredentials,
  ): WebhookEvent | null {
    if (!credentials.webhookSecret || !signature) return null;
    const expected = createHmac('sha256', credentials.webhookSecret).update(rawBody).digest('hex');
    if (!SecretBox.safeEqual(expected, signature)) return null;

    let parsed: RazorpayWebhookBody;
    try {
      parsed = JSON.parse(rawBody) as RazorpayWebhookBody;
    } catch {
      return null;
    }
    const entity = parsed.payload?.payment?.entity;
    return {
      type: parsed.event ?? 'unknown',
      providerOrderId: entity?.order_id ?? null,
      providerPaymentId: entity?.id ?? null,
      raw: parsed,
    };
  }
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
}
