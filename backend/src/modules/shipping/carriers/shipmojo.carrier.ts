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

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Shipmojo adapter. Shipmojo is a courier aggregator with the same token-auth
 * REST shape as most Indian aggregators: log in for a bearer token, quote rates
 * by pincode+weight, push an order, track by AWB.
 *
 * Because aggregators vary the exact host/paths per account tier, the base URL and
 * endpoint paths are read from `config` (with documented defaults) so a tenant can
 * point this at their Shipmojo account WITHOUT a code change — the pluggability the
 * port is designed for. Verify the paths against your Shipmojo API onboarding.
 *
 * credentials: { email, password }  (or { token } to skip login)
 * config: {
 *   originPostalCode, baseUrl?, pickupLocation?,
 *   paths?: { login?, serviceability?, createOrder?, track? }
 * }
 */
@Injectable()
export class ShipmojoCarrier implements ShippingCarrier {
  readonly provider = 'shipmojo';
  private readonly logger = new Logger(ShipmojoCarrier.name);
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  isConfigured(cfg: CarrierConfig): boolean {
    const hasAuth = Boolean(cfg.credentials.token || (cfg.credentials.email && cfg.credentials.password));
    return hasAuth && Boolean(cfg.config.originPostalCode);
  }

  async quote(params: RateQuoteParams, cfg: CarrierConfig): Promise<ShippingRate[]> {
    const origin = String(cfg.config.originPostalCode ?? '');
    if (!origin) return [];
    const token = await this.token(cfg);
    const weightKg = Math.max(
      0.5,
      params.items.reduce((g, i) => g + i.weightGrams * i.quantity, 0) / 1000,
    );

    const body = await this.request<ServiceabilityResponse>(cfg, path(cfg, 'serviceability', '/api/v1/rate/check'), token, {
      method: 'POST',
      body: {
        pickup_pincode: origin,
        delivery_pincode: params.destination.postalCode,
        weight: weightKg,
        cod: params.cod ? 1 : 0,
        declared_value: params.items.reduce((s, i) => s + (i.priceCents * i.quantity) / 100, 0),
      },
    });

    const options = body.data ?? body.rates ?? [];
    return options.map((o, idx) => ({
      service: `shipmojo:${o.courier_id ?? o.id ?? idx}`,
      label: o.courier_name ?? o.name ?? 'Shipmojo',
      carrier: 'shipmojo',
      amountCents: Math.round(Number(o.rate ?? o.total_charge ?? 0) * 100),
      currency: params.currency,
      ...(o.edd_days ? { estimatedDays: Number(o.edd_days) } : {}),
    }));
  }

  async createShipment(params: CreateShipmentParams, cfg: CarrierConfig): Promise<CreatedShipment> {
    const token = await this.token(cfg);
    const weightKg = Math.max(
      0.5,
      params.items.reduce((g, i) => g + i.weightGrams * i.quantity, 0) / 1000,
    );
    const body = await this.request<CreateOrderResponse>(cfg, path(cfg, 'createOrder', '/api/v1/order/create'), token, {
      method: 'POST',
      body: {
        order_number: params.orderNumber,
        pickup_location: String(cfg.config.pickupLocation ?? 'Primary'),
        payment_mode: params.cod ? 'COD' : 'Prepaid',
        consignee: {
          name: params.destination.name,
          address: params.destination.line1,
          address_2: params.destination.line2 ?? '',
          city: params.destination.city,
          state: params.destination.state ?? '',
          pincode: params.destination.postalCode,
          country: params.destination.country,
          phone: params.destination.phone ?? '',
          email: params.destination.email ?? '',
        },
        items: params.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.priceCents / 100 })),
        sub_total: params.subtotalCents / 100,
        weight: weightKg,
      },
    });

    const awb = body.awb ?? body.data?.awb ?? null;
    return {
      providerShipmentId: (body.shipment_id ?? body.data?.shipment_id ?? null)?.toString() ?? null,
      awb,
      carrierName: body.courier_name ?? body.data?.courier_name ?? 'shipmojo',
      trackingUrl: body.tracking_url ?? body.data?.tracking_url ?? null,
      costCents: 0,
    };
  }

  async track(awb: string, cfg: CarrierConfig): Promise<TrackingResult> {
    const token = await this.token(cfg);
    const body = await this.request<TrackResponse>(
      cfg,
      `${path(cfg, 'track', '/api/v1/track')}/${encodeURIComponent(awb)}`,
      token,
      { method: 'GET' },
    );
    const data = body.data ?? body;
    return {
      status: data.status ?? 'unknown',
      checkpoints: (data.checkpoints ?? data.scans ?? []).map((c) => ({
        at: c.date ?? c.timestamp ?? null,
        location: c.location ?? null,
        note: c.status ?? c.remark ?? null,
      })),
      trackingUrl: data.tracking_url ?? null,
    };
  }

  // --- HTTP / auth -----------------------------------------------------------
  private async token(cfg: CarrierConfig): Promise<string> {
    if (cfg.credentials.token) return cfg.credentials.token;
    const email = cfg.credentials.email;
    const cached = this.tokens.get(email);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const res = await this.request<{ token?: string; data?: { token?: string } }>(
      cfg,
      path(cfg, 'login', '/api/v1/auth/login'),
      null,
      { method: 'POST', body: { email, password: cfg.credentials.password } },
    );
    const token = res.token ?? res.data?.token;
    if (!token) {
      throw AppException.validation('Shipmojo login failed — check the connected credentials.');
    }
    this.tokens.set(email, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  }

  private async request<T>(
    cfg: CarrierConfig,
    p: string,
    token: string | null,
    opts: { method: string; body?: unknown },
  ): Promise<T> {
    const base = String(cfg.config.baseUrl ?? 'https://api.shipmojo.in').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${base}${p}`, {
        method: opts.method,
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch (err) {
      this.logger.error(`Shipmojo request failed (${p}): ${(err as Error).message}`);
      throw AppException.conflict('shipping_carrier_unreachable', 'Could not reach the shipping carrier.');
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string } & T;
    if (!res.ok) {
      this.logger.error(`Shipmojo ${p} -> ${res.status}: ${JSON.stringify(body)}`);
      throw AppException.conflict('shipping_carrier_error', body.message ?? 'The shipping carrier rejected the request.');
    }
    return body;
  }
}

/** Resolve a config-overridable endpoint path, falling back to the default. */
function path(cfg: CarrierConfig, key: string, fallback: string): string {
  const paths = (cfg.config.paths as Record<string, string> | undefined) ?? {};
  return paths[key] ?? fallback;
}

interface RateOption {
  courier_id?: number | string;
  id?: number | string;
  courier_name?: string;
  name?: string;
  rate?: number | string;
  total_charge?: number | string;
  edd_days?: number | string;
}
interface ServiceabilityResponse {
  data?: RateOption[];
  rates?: RateOption[];
}
interface CreateOrderResponse {
  awb?: string | null;
  shipment_id?: string | number | null;
  courier_name?: string;
  tracking_url?: string | null;
  data?: { awb?: string | null; shipment_id?: string | number | null; courier_name?: string; tracking_url?: string | null };
}
interface TrackScan {
  date?: string;
  timestamp?: string;
  location?: string;
  status?: string;
  remark?: string;
}
interface TrackBody {
  status?: string;
  tracking_url?: string | null;
  checkpoints?: TrackScan[];
  scans?: TrackScan[];
}
interface TrackResponse extends TrackBody {
  data?: TrackBody;
}
