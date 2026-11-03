import { Injectable } from '@nestjs/common';

import type {
  CarrierConfig,
  CreateShipmentParams,
  CreatedShipment,
  RateQuoteParams,
  ShippingCarrier,
  ShippingRate,
  TrackingResult,
} from './shipping-carrier';

/**
 * The "no external carrier" mode — merchant-defined flat, free, per-kg, or
 * free-over-threshold shipping. Category-agnostic and fully local, so a store can
 * charge shipping the moment it's provisioned, before connecting a real carrier.
 * Fulfilment is manual: staff ship it themselves and can record a tracking number.
 *
 * config: {
 *   mode: "flat" | "free" | "per_kg" | "free_over",
 *   flatCents?: number,        // flat & free_over base
 *   perKgCents?: number,       // per_kg
 *   freeOverCents?: number,    // free_over: free when subtotal >= this
 *   label?: string,
 *   etaDays?: number
 * }
 */
@Injectable()
export class ManualShippingCarrier implements ShippingCarrier {
  readonly provider = 'manual';

  isConfigured(): boolean {
    return true; // sensible defaults; always usable
  }

  quote(params: RateQuoteParams, cfg: CarrierConfig): Promise<ShippingRate[]> {
    const c = cfg.config as ManualConfig;
    const mode = c.mode ?? 'free';
    const label = c.label ?? 'Standard shipping';
    const etaDays = numeric(c.etaDays);

    let amountCents = 0;
    switch (mode) {
      case 'flat':
        amountCents = numeric(c.flatCents) ?? 0;
        break;
      case 'per_kg': {
        const perKg = numeric(c.perKgCents) ?? 0;
        const totalGrams = params.items.reduce((g, i) => g + i.weightGrams * i.quantity, 0);
        amountCents = Math.ceil(totalGrams / 1000) * perKg;
        break;
      }
      case 'free_over': {
        const threshold = numeric(c.freeOverCents) ?? 0;
        const subtotal = params.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
        amountCents = subtotal >= threshold ? 0 : numeric(c.flatCents) ?? 0;
        break;
      }
      case 'free':
      default:
        amountCents = 0;
    }

    return Promise.resolve([
      {
        service: 'manual',
        label,
        carrier: 'manual',
        amountCents,
        currency: params.currency,
        ...(etaDays !== undefined ? { estimatedDays: etaDays } : {}),
      },
    ]);
  }

  createShipment(_params: CreateShipmentParams, _cfg: CarrierConfig): Promise<CreatedShipment> {
    // No carrier API — the shipment is recorded, staff fulfil it and may later
    // attach a tracking number via the admin.
    return Promise.resolve({
      providerShipmentId: null,
      awb: null,
      carrierName: 'manual',
      trackingUrl: null,
      costCents: 0,
    });
  }

  track(_awb: string, _cfg: CarrierConfig): Promise<TrackingResult> {
    return Promise.resolve({ status: 'unknown', checkpoints: [], trackingUrl: null });
  }
}

interface ManualConfig {
  mode?: 'flat' | 'free' | 'per_kg' | 'free_over';
  flatCents?: number;
  perKgCents?: number;
  freeOverCents?: number;
  label?: string;
  etaDays?: number;
}

/** Tolerate string/number JSON values without trusting arbitrary input. */
function numeric(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
