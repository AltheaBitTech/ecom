/**
 * The payment gateway port. Every provider (Razorpay today, others later) is an
 * adapter behind this interface, so the rest of the app never speaks a specific
 * gateway's dialect. Credentials are passed in per call — they belong to the
 * tenant, not the process — so one adapter instance serves every tenant.
 */

/** Decrypted, per-tenant gateway credentials. */
export interface GatewayCredentials {
  publicKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
}

/** What the storefront needs to open the gateway's checkout for an order. */
export interface PaymentIntent {
  provider: string;
  /** Gateway-side order/intent id (Razorpay `order_id`). */
  providerOrderId: string;
  /** Public key the browser SDK initialises with. */
  publicKey: string | null;
  amountCents: number;
  currency: string;
}

/** The client's post-payment callback, verified for authenticity. */
export interface PaymentCallback {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface CreateOrderParams {
  credentials: GatewayCredentials;
  amountCents: number;
  currency: string;
  /** Our order number, echoed back by the gateway for reconciliation. */
  receipt: string;
  notes?: Record<string, string>;
}

/** A verified webhook event, normalised across providers. */
export interface WebhookEvent {
  /** e.g. "payment.captured", "payment.failed". */
  type: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  raw: unknown;
}

export interface PaymentGateway {
  readonly provider: string;

  /** True once the tenant has supplied the credentials this provider needs. */
  isConfigured(credentials: GatewayCredentials): boolean;

  /** Create a gateway-side order/intent the shopper will pay against. */
  createOrder(params: CreateOrderParams): Promise<{ providerOrderId: string }>;

  /** Verify a client-side payment callback (HMAC over order|payment). */
  verifyCallback(callback: PaymentCallback, credentials: GatewayCredentials): boolean;

  /** Verify and parse a webhook body against its signature header. */
  verifyWebhook(
    rawBody: string,
    signature: string | undefined,
    credentials: GatewayCredentials,
  ): WebhookEvent | null;
}
