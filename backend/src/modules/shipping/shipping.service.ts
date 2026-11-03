import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { SecretBox } from '../../common/crypto/secret-box';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService, type Tx } from '../../common/prisma/prisma.service';
import type { CheckoutItemDto } from '../orders/dto/orders.dto';

import { CarrierRegistry } from './carriers/carrier.registry';
import type {
  CarrierConfig,
  RateDestination,
  RateItem,
  ShippingRate,
  TrackingResult,
} from './carriers/shipping-carrier';
import type { UpsertShippingAccountDto } from './dto/shipping.dto';

/** Non-secret view of a tenant's shipping configuration. */
export interface ShippingAccountView {
  provider: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configured: boolean;
  has_secrets: boolean;
  supported_providers: string[];
}

/** The shipping cost chosen for an order at checkout. */
export interface ChosenRate {
  service: string;
  label: string;
  carrier: string;
  amount_cents: number;
}

interface LoadedAccount {
  provider: string;
  enabled: boolean;
  cfg: CarrierConfig;
}

/**
 * Shipping. Mirrors the payment layer: a pluggable carrier port, per-tenant
 * (encrypted) credentials, and a shipment ledger. Rate quotes are server-computed
 * and drive Order.shippingCents at checkout — the client's number is never
 * trusted. Carrier HTTP calls always run OUTSIDE the database transaction so a
 * slow carrier never holds a row lock.
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBox,
    private readonly carriers: CarrierRegistry,
    private readonly audit: AuditService,
  ) {}

  // --- Rating (storefront + checkout) ---------------------------------------
  /** Quote all available shipping options for a cart going to a destination. */
  async quoteForCart(
    tenantId: string,
    items: CheckoutItemDto[],
    destination: RateDestination,
    cod = false,
  ): Promise<ShippingRate[]> {
    const { rateItems, currency, account } = await this.prisma.forTenant(tenantId, async (tx) => {
      const priced = await this.resolveRateItems(tx, items);
      const acct = await this.loadAccountTx(tx, tenantId);
      return { rateItems: priced.rateItems, currency: priced.currency, account: acct };
    });

    if (!account.enabled) return [];
    const carrier = this.carriers.get(account.provider);

    // A selected provider that isn't fully connected yet must not block checkout —
    // fall back to a single free "Standard" option so orders can still be placed.
    if (!carrier.isConfigured(account.cfg)) {
      return [{ service: 'manual', label: 'Standard shipping', carrier: 'manual', amountCents: 0, currency }];
    }

    try {
      const rates = await carrier.quote({ destination, items: rateItems, currency, cod }, account.cfg);
      return rates.length
        ? rates
        : [{ service: 'manual', label: 'Standard shipping', carrier: 'manual', amountCents: 0, currency }];
    } catch (err) {
      this.logger.warn(`Rate quote failed for ${account.provider}; defaulting to free: ${(err as Error).message}`);
      return [{ service: 'manual', label: 'Standard shipping', carrier: 'manual', amountCents: 0, currency }];
    }
  }

  /**
   * The single rate to charge an order at checkout: the shopper's selected service
   * if valid, otherwise the cheapest available. Returns null shipping (0) when the
   * store offers no paid options. Called by OrdersService before its own tx.
   */
  async quoteForCheckout(
    tenantId: string,
    items: CheckoutItemDto[],
    destination: RateDestination,
    service?: string,
    cod = false,
  ): Promise<ChosenRate> {
    const rates = await this.quoteForCart(tenantId, items, destination, cod);
    if (rates.length === 0) {
      return { service: 'none', label: 'No shipping', carrier: 'none', amount_cents: 0 };
    }
    const selected =
      (service ? rates.find((r) => r.service === service) : undefined) ??
      [...rates].sort((a, b) => a.amountCents - b.amountCents)[0];
    return {
      service: selected.service,
      label: selected.label,
      carrier: selected.carrier,
      amount_cents: selected.amountCents,
    };
  }

  // --- Fulfilment (admin) ----------------------------------------------------
  /** Create a shipment for a paid order with the connected carrier. */
  async createShipment(tenantId: string, orderId: string, actorUserId: string): Promise<ShipmentView> {
    const order = await this.prisma.forTenant(tenantId, (tx) =>
      tx.order.findFirst({ where: { id: orderId }, include: { items: true } }),
    );
    if (!order) throw AppException.notFound('Order not found');

    const account = await this.loadAccount(tenantId);
    const carrier = this.carriers.get(account.provider);

    // Product weights for the order's items (fall back to a default if missing).
    const productIds = order.items.map((i) => i.productId).filter((id): id is string => Boolean(id));
    const weights = await this.prisma.forTenant(tenantId, (tx) =>
      tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, weightGrams: true } }),
    );
    const weightById = new Map(weights.map((w) => [w.id, w.weightGrams]));
    const address = (order.shippingAddress ?? {}) as Record<string, string>;

    const created = await carrier.createShipment(
      {
        orderNumber: order.number,
        destination: {
          name: address.name ?? '',
          line1: address.line1 ?? '',
          line2: address.line2,
          city: address.city ?? '',
          state: address.state,
          postalCode: address.postal_code ?? '',
          country: address.country ?? '',
          phone: address.phone,
          email: order.guestEmail ?? undefined,
        },
        items: order.items.map((i) => ({
          name: i.nameSnapshot,
          quantity: i.quantity,
          priceCents: i.priceCents,
          weightGrams: (i.productId && weightById.get(i.productId)) || 500,
        })),
        subtotalCents: order.subtotalCents,
        currency: order.currency,
        cod: false,
      },
      account.cfg,
    );

    const shipment = await this.prisma.forTenant(tenantId, (tx) =>
      tx.shipment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: account.provider,
          status: created.awb ? ShipmentStatus.CREATED : ShipmentStatus.PENDING,
          carrierName: created.carrierName,
          awb: created.awb,
          trackingUrl: created.trackingUrl,
          costCents: created.costCents,
          providerShipmentId: created.providerShipmentId,
        },
      }),
    );

    await this.audit.record({
      tenantId,
      actorKind: 'staff',
      actorId: actorUserId,
      action: 'shipment.created',
      target: order.id,
      method: 'POST',
      route: '/tenants/:tenantId/orders/:id/shipment',
      statusCode: 201,
      metadata: { provider: account.provider, awb: created.awb },
    });
    return toShipmentView(shipment);
  }

  /** Live tracking for an order's most recent shipment. */
  async track(tenantId: string, orderId: string): Promise<TrackingResult & { awb: string | null }> {
    const shipment = await this.prisma.forTenant(tenantId, (tx) =>
      tx.shipment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } }),
    );
    if (!shipment) throw AppException.notFound('No shipment found for this order');
    if (!shipment.awb) {
      return { awb: null, status: shipment.status, checkpoints: [], trackingUrl: shipment.trackingUrl };
    }
    const account = await this.loadAccount(tenantId);
    const carrier = this.carriers.get(shipment.provider);
    const result = await carrier.track(shipment.awb, account.cfg);
    return { awb: shipment.awb, ...result };
  }

  // --- Admin config ----------------------------------------------------------
  async getAccount(tenantId: string): Promise<ShippingAccountView> {
    const row = await this.prisma.forTenant(tenantId, (tx) =>
      tx.shippingAccount.findUnique({ where: { tenantId } }),
    );
    const provider = row?.provider ?? 'manual';
    const cfg: CarrierConfig = {
      config: (row?.config as Record<string, unknown>) ?? {},
      credentials: row?.secretsEnc ? this.decryptSecrets(row.secretsEnc) : {},
    };
    return {
      provider,
      enabled: row?.enabled ?? (provider === 'manual'),
      config: cfg.config,
      configured: this.carriers.get(provider).isConfigured(cfg),
      has_secrets: Boolean(row?.secretsEnc),
      supported_providers: this.carriers.supported(),
    };
  }

  async upsertAccount(
    tenantId: string,
    dto: UpsertShippingAccountDto,
    actorUserId: string,
  ): Promise<ShippingAccountView> {
    if (!this.carriers.isSupported(dto.provider)) {
      throw AppException.validation(`Unsupported shipping provider "${dto.provider}".`);
    }
    const existing = await this.prisma.forTenant(tenantId, (tx) =>
      tx.shippingAccount.findUnique({ where: { tenantId } }),
    );
    const switchingProvider = existing?.provider !== dto.provider;

    const config = dto.config ?? (switchingProvider ? {} : (existing?.config as Record<string, unknown>) ?? {});
    const secretsEnc =
      dto.secrets !== undefined
        ? this.secrets.encrypt(JSON.stringify(dto.secrets))
        : switchingProvider
          ? null
          : existing?.secretsEnc ?? null;
    const enabled = dto.enabled ?? existing?.enabled ?? true;

    const create: Prisma.ShippingAccountUncheckedCreateInput = {
      tenantId,
      provider: dto.provider,
      enabled,
      config: config as Prisma.InputJsonValue,
      secretsEnc,
    };
    await this.prisma.forTenant(tenantId, (tx) =>
      tx.shippingAccount.upsert({
        where: { tenantId },
        create,
        update: { provider: dto.provider, enabled, config: config as Prisma.InputJsonValue, secretsEnc },
      }),
    );

    await this.audit.record({
      tenantId,
      actorKind: 'staff',
      actorId: actorUserId,
      action: 'shipping_account.updated',
      target: tenantId,
      method: 'PUT',
      route: '/tenants/:tenantId/shipping-account',
      statusCode: 200,
      metadata: { provider: dto.provider, enabled },
    });
    return this.getAccount(tenantId);
  }

  // --- Internals -------------------------------------------------------------
  private async resolveRateItems(
    tx: Tx,
    items: CheckoutItemDto[],
  ): Promise<{ rateItems: RateItem[]; currency: string }> {
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    }
    const products = await tx.product.findMany({
      where: { id: { in: [...quantities.keys()] }, deletedAt: null, status: 'ACTIVE' },
    });
    const currency = products[0]?.currency ?? 'INR';
    const rateItems: RateItem[] = products.map((p) => ({
      weightGrams: p.weightGrams,
      quantity: quantities.get(p.id) ?? 0,
      priceCents: p.priceCents,
    }));
    return { rateItems, currency };
  }

  private async loadAccount(tenantId: string): Promise<LoadedAccount> {
    return this.prisma.forTenant(tenantId, (tx) => this.loadAccountTx(tx, tenantId));
  }

  private async loadAccountTx(tx: Tx, tenantId: string): Promise<LoadedAccount> {
    const row = await tx.shippingAccount.findUnique({ where: { tenantId } });
    if (!row) {
      // Default to the manual (free) carrier so orders can always be placed.
      return { provider: 'manual', enabled: true, cfg: { config: {}, credentials: {} } };
    }
    return {
      provider: row.provider,
      enabled: row.enabled,
      cfg: {
        config: (row.config as Record<string, unknown>) ?? {},
        credentials: row.secretsEnc ? this.decryptSecrets(row.secretsEnc) : {},
      },
    };
  }

  private decryptSecrets(enc: string): Record<string, string> {
    try {
      return JSON.parse(this.secrets.decrypt(enc)) as Record<string, string>;
    } catch (err) {
      this.logger.error(`Failed to decrypt shipping credentials: ${(err as Error).message}`);
      return {};
    }
  }
}

export interface ShipmentView {
  id: string;
  order_id: string;
  provider: string;
  status: ShipmentStatus;
  carrier_name: string | null;
  awb: string | null;
  tracking_url: string | null;
  created_at: Date;
}

function toShipmentView(s: {
  id: string;
  orderId: string;
  provider: string;
  status: ShipmentStatus;
  carrierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  createdAt: Date;
}): ShipmentView {
  return {
    id: s.id,
    order_id: s.orderId,
    provider: s.provider,
    status: s.status,
    carrier_name: s.carrierName,
    awb: s.awb,
    tracking_url: s.trackingUrl,
    created_at: s.createdAt,
  };
}
