/**
 * The shipping carrier port. Every carrier (Shiprocket, Shipmojo, a manual
 * flat-rate mode, or anything integrated later) is an adapter behind this
 * interface so the rest of the app never speaks a specific carrier's dialect.
 * Config and credentials are passed in per call — they belong to the tenant, not
 * the process — so one adapter instance serves every tenant.
 */

/** A tenant's carrier configuration: public settings + decrypted credentials. */
export interface CarrierConfig {
  /** Non-secret settings (origin pincode, flat-rate rules, ...). */
  config: Record<string, unknown>;
  /** Decrypted credentials (carrier email/password/token). */
  credentials: Record<string, string>;
}

export interface RateDestination {
  postalCode: string;
  country: string;
}

/** One line's shipping-relevant facts. Price drives free-over-threshold rules. */
export interface RateItem {
  weightGrams: number;
  quantity: number;
  priceCents: number;
}

export interface RateQuoteParams {
  destination: RateDestination;
  items: RateItem[];
  currency: string;
  /** Cash-on-delivery — some carriers price it differently. */
  cod: boolean;
}

/** A quoted shipping option the shopper can pick. */
export interface ShippingRate {
  /** Stable machine id for selection at checkout (e.g. "manual", "sr:12"). */
  service: string;
  /** Human label ("Standard", "Delhivery Surface"). */
  label: string;
  carrier: string;
  amountCents: number;
  currency: string;
  estimatedDays?: number;
}

export interface CreateShipmentParams {
  orderNumber: string;
  destination: RateDestination & {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    phone?: string;
    email?: string;
  };
  items: Array<{ name: string; quantity: number; priceCents: number; weightGrams: number }>;
  subtotalCents: number;
  currency: string;
  cod: boolean;
  /** The service id the shopper selected at checkout, if any. */
  service?: string;
}

export interface CreatedShipment {
  providerShipmentId: string | null;
  awb: string | null;
  carrierName: string | null;
  trackingUrl: string | null;
  costCents: number;
}

export interface TrackingResult {
  status: string;
  checkpoints: Array<{ at: string | null; location: string | null; note: string | null }>;
  trackingUrl: string | null;
}

export interface ShippingCarrier {
  readonly provider: string;

  /** True once the tenant has supplied everything this carrier needs. */
  isConfigured(cfg: CarrierConfig): boolean;

  /** Quote available shipping options for a cart going to a destination. */
  quote(params: RateQuoteParams, cfg: CarrierConfig): Promise<ShippingRate[]>;

  /** Hand a paid order to the carrier and return its shipment/AWB. */
  createShipment(params: CreateShipmentParams, cfg: CarrierConfig): Promise<CreatedShipment>;

  /** Look up live tracking for an AWB. */
  track(awb: string, cfg: CarrierConfig): Promise<TrackingResult>;
}
