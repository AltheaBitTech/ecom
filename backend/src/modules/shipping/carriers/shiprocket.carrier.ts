import { Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/errors/app-exception';

import type {
  CarrierConfig,
  CreateShipmentParams,
  CreatedShipment,
  RateQuoteParams,
  ShippingCarrier,
  ShippingRate,
  TrackingResult,
} from './shipping-carrier';

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // Shiprocket tokens last ~10 days; refresh well within that.

/**
 * Shiprocket adapter. Authenticates with the tenant's own email/password to mint
 * a bearer token (cached per-account until it nears expiry), then quotes rates via
 * the serviceability API, creates ad-hoc orders + assigns an AWB for fulfilment,
 * and reads live tracking. No SDK — plain REST with the tenant's credentials.
 *
 * credentials: { email, password }
 * config: { originPostalCode, pickupLocation?, lengthCm?, breadthCm?, heightCm? }
 */
@Injectable()
export class ShiprocketCarrier implements ShippingCarrier {
  readonly provider = 'shiprocket';
  private readonly logger = new Logger(ShiprocketCarrier.name);
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  isConfigured(cfg: CarrierConfig): boolean {
    return Boolean(cfg.credentials.email && cfg.credentials.password && cfg.config.originPostalCode);
  }

  async quote(params: RateQuoteParams, cfg: CarrierConfig): Promise<ShippingRate[]> {
    const origin = String(cfg.config.originPostalCode ?? '');
    if (!origin) return [];
    const token = await this.token(cfg);

    const weightKg = Math.max(
      0.5,
      params.items.reduce((g, i) => g + i.weightGrams * i.quantity, 0) / 1000,
    );
    const declaredValue = params.items.reduce((s, i) => s + (i.priceCents * i.quantity) / 100, 0);

    const qs = new URLSearchParams({
      pickup_postcode: origin,
      delivery_postcode: params.destination.postalCode,
      weight: weightKg.toFixed(2),
      cod: params.cod ? '1' : '0',
      declared_value: declaredValue.toFixed(2),
    });

    const body = await this.get<ServiceabilityResponse>(`/courier/serviceability/?${qs}`, token);
    const couriers = body.data?.available_courier_companies ?? [];
    return couriers.map((c) => ({
      service: `shiprocket:${c.courier_company_id}`,
      label: c.courier_name,
      carrier: 'shiprocket',
      amountCents: Math.round(Number(c.rate) * 100),
      currency: params.currency,
      ...(c.estimated_delivery_days ? { estimatedDays: Number(c.estimated_delivery_days) } : {}),
    }));
  }

  async createShipment(params: CreateShipmentParams, cfg: CarrierConfig): Promise<CreatedShipment> {
    const token = await this.token(cfg);
    const c = cfg.config as Record<string, unknown>;
    const dims = {
      length: numberOr(c.lengthCm, 10),
      breadth: numberOr(c.breadthCm, 10),
      height: numberOr(c.heightCm, 10),
    };
    const weightKg = Math.max(
      0.5,
      params.items.reduce((g, i) => g + i.weightGrams * i.quantity, 0) / 1000,
    );

    const created = await this.post<CreateOrderResponse>(
      '/orders/create/adhoc',
      {
        order_id: params.orderNumber,
        order_date: new Date(Date.now()).toISOString().slice(0, 10),
        pickup_location: String(c.pickupLocation ?? 'Primary'),
        billing_customer_name: params.destination.name,
        billing_last_name: '',
        billing_address: params.destination.line1,
        billing_address_2: params.destination.line2 ?? '',
        billing_city: params.destination.city,
        billing_pincode: params.destination.postalCode,
        billing_state: params.destination.state ?? '',
        billing_country: params.destination.country,
        billing_email: params.destination.email ?? '',
        billing_phone: params.destination.phone ?? '',
        shipping_is_billing: true,
        order_items: params.items.map((i) => ({
          name: i.name,
          sku: i.name.slice(0, 40),
          units: i.quantity,
          selling_price: i.priceCents / 100,
        })),
        payment_method: params.cod ? 'COD' : 'Prepaid',
        sub_total: params.subtotalCents / 100,
        length: dims.length,
        breadth: dims.breadth,
        height: dims.height,
        weight: weightKg,
      },
      token,
    );

    if (!created.shipment_id) {
      throw AppException.conflict('shipping_error', 'Shiprocket did not return a shipment id.');
    }

    // Assign an AWB so the order is actually shippable. Non-fatal on failure —
    // the shipment exists and an AWB can be assigned later from Shiprocket.
    let awb: string | null = null;
    let carrierName: string | null = null;
    try {
      const assigned = await this.post<AssignAwbResponse>(
        '/courier/assign/awb',
        { shipment_id: created.shipment_id },
        token,
      );
      awb = assigned.response?.data?.awb_code ?? null;
      carrierName = assigned.response?.data?.courier_name ?? null;
    } catch (err) {
      this.logger.warn(`AWB assignment failed for shipment ${created.shipment_id}: ${(err as Error).message}`);
    }

    return {
      providerShipmentId: String(created.shipment_id),
      awb,
      carrierName,
      trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : null,
      costCents: 0,
    };
  }

  async track(awb: string, cfg: CarrierConfig): Promise<TrackingResult> {
    const token = await this.token(cfg);
    const body = await this.get<TrackResponse>(`/courier/track/awb/${encodeURIComponent(awb)}`, token);
    const td = body.tracking_data;
    return {
      status: td?.shipment_track?.[0]?.current_status ?? td?.track_status?.toString() ?? 'unknown',
      checkpoints: (td?.shipment_track_activities ?? []).map((a) => ({
        at: a.date ?? null,
        location: a.location ?? null,
        note: a.activity ?? null,
      })),
      trackingUrl: td?.track_url ?? `https://shiprocket.co/tracking/${awb}`,
    };
  }

  // --- HTTP / auth -----------------------------------------------------------
  private async token(cfg: CarrierConfig): Promise<string> {
    const email = cfg.credentials.email;
    const cached = this.tokens.get(email);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const res = await this.fetchJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: cfg.credentials.password }),
    });
    const token = (res as { token?: string }).token;
    if (!token) {
      throw AppException.validation('Shiprocket login failed — check the connected credentials.');
    }
    this.tokens.set(email, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  }

  private get<T>(path: string, token: string): Promise<T> {
    return this.fetchJson(path, { headers: { Authorization: `Bearer ${token}` } }) as Promise<T>;
  }

  private post<T>(path: string, payload: unknown, token: string): Promise<T> {
    return this.fetchJson(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }) as Promise<T>;
  }

  private async fetchJson(path: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${SR_BASE}${path}`, init);
    } catch (err) {
      this.logger.error(`Shiprocket request failed (${path}): ${(err as Error).message}`);
      throw AppException.conflict('shipping_carrier_unreachable', 'Could not reach the shipping carrier.');
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      this.logger.error(`Shiprocket ${path} -> ${res.status}: ${JSON.stringify(body)}`);
      throw AppException.conflict('shipping_carrier_error', body.message ?? 'The shipping carrier rejected the request.');
    }
    return body;
  }
}

const numberOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : fallback;

interface ServiceabilityResponse {
  data?: {
    available_courier_companies?: Array<{
      courier_company_id: number;
      courier_name: string;
      rate: number | string;
      estimated_delivery_days?: number | string;
    }>;
  };
}
interface CreateOrderResponse {
  order_id?: number;
  shipment_id?: number;
}
interface AssignAwbResponse {
  response?: { data?: { awb_code?: string; courier_name?: string } };
}
interface TrackResponse {
  tracking_data?: {
    track_status?: number;
    track_url?: string;
    shipment_track?: Array<{ current_status?: string }>;
    shipment_track_activities?: Array<{ date?: string; location?: string; activity?: string }>;
  };
}
