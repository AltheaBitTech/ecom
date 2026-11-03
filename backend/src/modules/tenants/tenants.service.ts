import { Injectable, Logger } from '@nestjs/common';
import { MembershipStatus, MembershipType, Prisma } from '@prisma/client';
import { jwtVerify, SignJWT } from 'jose';

import { AppConfig } from '../../common/config/app-config';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { BillingService } from '../billing/billing.service';
import { AttributeValidatorService } from '../catalog/attribute-validator.service';
import { RbacService } from '../rbac/rbac.service';

import type { ProvisionTenantDto, SaveStoreDesignDto, SetAttributeSchemaDto, UpdateSettingsDto } from './dto/tenants.dto';
import { defaultStoreDesign, normalizeStoreDesign, parseStoreDesign, templateAccess, TEMPLATE_IDS } from './store-design';

/**
 * Tenant lifecycle and configuration. Provisioning is the one cross-tenant
 * operation (the tenant row does not exist yet), so it runs under asPlatform;
 * everything else is tenant-scoped under RLS via forTenant.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly rbac: RbacService,
    private readonly attributes: AttributeValidatorService,
    private readonly billing: BillingService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Self-serve store creation, end to end in ecom's own database:
   *   1. register the owner's global, password-backed User (so they can sign in
   *      immediately),
   *   2. create the Tenant + its settings + subscription under asPlatform,
   *   3. clone the system-role templates into the tenant and grant the owner the
   *      grant-on-provision (Admin) role under RLS.
   * The tenant id is issued locally (cuid) and is what every token's tenant_id
   * resolves against.
   */
  async provision(dto: ProvisionTenantDto): Promise<{ id: string; slug: string; name: string }> {
    const slug = dto.slug.toLowerCase();

    // Reject a duplicate subdomain before creating any identity.
    const existing = await this.prisma.asPlatform((tx) => tx.tenant.findUnique({ where: { slug } }));
    if (existing) {
      throw AppException.conflict('slug_taken', `The subdomain "${slug}" is already in use`);
    }

    // Owner identity first: register() creates the global User with a password
    // (+ PASSWORD identity + verification email) and rejects an already-taken
    // email, so the owner walks away with a usable credential.
    const owner = await this.auth.register({
      email: dto.owner_email,
      password: dto.owner_password,
      name: dto.owner_name,
    });

    const planKey = dto.plan_key ?? 'starter';

    // Tenant + settings + subscription are one cross-tenant unit (the tenant row
    // does not exist yet), so they run under asPlatform in a single transaction.
    const tenantId = await this.prisma.asPlatform(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug, name: dto.name } });
      const design = defaultStoreDesign();
      const designJson = design as unknown as Prisma.InputJsonValue;
      await tx.tenantSettings.create({ data: { tenantId: tenant.id, storeName: dto.name, currency: 'INR', locale: 'en-IN', theme: designJson, draftTheme: designJson, draftRevision: 1, publishedRevision: 1, publishedAt: new Date() } });
      await tx.subscription.create({ data: { tenantId: tenant.id, planKey, status: 'TRIALING' } });
      return tenant.id;
    });

    // Clone the NULL-tenant role templates into this tenant and grant the owner
    // the grant-on-provision (Admin) role — both under the tenant's RLS context.
    const { grantOnProvisionRoleId } = await this.rbac.cloneSystemRoles(tenantId);
    await this.prisma.forTenant(tenantId, (tx) =>
      tx.userTenantRole.create({
        data: {
          userId: owner.user_id,
          tenantId,
          roleId: grantOnProvisionRoleId,
          type: MembershipType.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
    );

    this.logger.log(`Provisioned tenant ${tenantId} (${slug}) on plan ${planKey}`);
    return { id: tenantId, slug, name: dto.name };
  }

  /**
   * Public subdomain → store resolver. Given a slug (the subdomain label) returns
   * the tenant id and display name so the storefront and admin sign-in can
   * bootstrap before any token exists — a merchant knows their store's address,
   * not its opaque id. Cross-tenant by nature (the caller has no id yet), so it
   * runs under asPlatform but returns only already-public fields.
   */
  async resolveBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) throw AppException.notFound('Store not found');
    const tenant = await this.prisma.asPlatform((tx) =>
      tx.tenant.findUnique({
        where: { slug: normalized },
        select: { id: true, slug: true, name: true, status: true },
      }),
    );
    if (!tenant) throw AppException.notFound('Store not found');
    return { tenant_id: tenant.id, slug: tenant.slug, store_name: tenant.name, status: tenant.status };
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, include: { settings: true, subscription: true } }),
    );
    if (!tenant) throw AppException.notFound('Store not found');
    return this.toTenantView(tenant);
  }

  async getSettings(tenantId: string) {
    const settings = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantSettings.findUnique({ where: { tenantId } }),
    );
    if (!settings) throw AppException.notFound('Store settings not found');
    return this.toSettingsView(settings, true);
  }

  async getStorefrontSettings(tenantId: string, previewToken?: string) {
    const settings = await this.prisma.forTenant(tenantId, (tx) => tx.tenantSettings.findUnique({ where: { tenantId } }));
    if (!settings) throw AppException.notFound('Store settings not found');
    if (!previewToken) return this.toSettingsView(settings, false);

    try {
      const { payload } = await jwtVerify(previewToken, new TextEncoder().encode(this.config.apiKeyHashSecret), {
        issuer: 'ecom-storefront', audience: 'storefront-preview',
      });
      if (payload.tenant_id !== tenantId || payload.revision !== settings.draftRevision) throw new Error('stale preview');
    } catch {
      throw AppException.unauthenticated('Preview link is invalid or expired');
    }
    return { ...this.toSettingsView(settings, false), theme: normalizeStoreDesign(settings.draftTheme), preview: true };
  }

  async getDesign(tenantId: string) {
    const settings = await this.prisma.forTenant(tenantId, (tx) => tx.tenantSettings.findUnique({ where: { tenantId } }));
    if (!settings) throw AppException.notFound('Store settings not found');
    return {
      draft: normalizeStoreDesign(settings.draftTheme),
      published: normalizeStoreDesign(settings.theme),
      draft_revision: settings.draftRevision,
      published_revision: settings.publishedRevision,
      published_at: settings.publishedAt?.toISOString() ?? null,
    };
  }

  async saveDesignDraft(tenantId: string, dto: SaveStoreDesignDto) {
    const design = parseStoreDesign(dto.design);
    const designJson = design as unknown as Prisma.InputJsonValue;
    const entitlements = await this.billing.entitlements(tenantId);
    if (!templateAccess(design.templateId, entitlements.features)) throw AppException.featureNotInPlan('Upgrade your plan to use this storefront template');

    const updated = await this.prisma.forTenant(tenantId, async (tx) => {
      if (dto.expected_revision !== undefined) {
        const result = await tx.tenantSettings.updateMany({
          where: { tenantId, draftRevision: dto.expected_revision },
          data: { draftTheme: designJson, draftRevision: { increment: 1 } },
        });
        if (result.count === 0) throw AppException.conflict('design_revision_conflict', 'This draft changed in another session. Reload before saving.');
      } else {
        await tx.tenantSettings.update({ where: { tenantId }, data: { draftTheme: designJson, draftRevision: { increment: 1 } } });
      }
      return tx.tenantSettings.findUniqueOrThrow({ where: { tenantId } });
    });
    return { draft: design, draft_revision: updated.draftRevision };
  }

  async createDesignPreview(tenantId: string) {
    const settings = await this.prisma.forTenant(tenantId, (tx) => tx.tenantSettings.findUnique({ where: { tenantId } }));
    if (!settings) throw AppException.notFound('Store settings not found');
    const token = await new SignJWT({ tenant_id: tenantId, revision: settings.draftRevision })
      .setProtectedHeader({ alg: 'HS256' }).setIssuer('ecom-storefront').setAudience('storefront-preview')
      .setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(this.config.apiKeyHashSecret));
    return { preview_token: token, expires_in: 1800, draft_revision: settings.draftRevision };
  }

  async publishDesign(tenantId: string) {
    const entitlements = await this.billing.entitlements(tenantId);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
      if (!settings) throw AppException.notFound('Store settings not found');
      const design = parseStoreDesign(settings.draftTheme);
      const designJson = design as unknown as Prisma.InputJsonValue;
      if (!templateAccess(design.templateId, entitlements.features)) throw AppException.featureNotInPlan('Upgrade your plan to publish this storefront template');
      const published = await tx.tenantSettings.update({
        where: { tenantId },
        data: { theme: designJson, publishedRevision: settings.draftRevision, publishedAt: new Date() },
      });
      return { published: design, published_revision: published.publishedRevision, published_at: published.publishedAt?.toISOString() ?? null };
    });
  }

  async listDesignTemplates(tenantId: string) {
    const { features } = await this.billing.entitlements(tenantId);
    return TEMPLATE_IDS.map((id) => ({ id, available: templateAccess(id, features) }));
  }

  async updateSettings(tenantId: string, dto: UpdateSettingsDto) {
    // Custom domains are a plan-gated feature — enforced through hasFeature,
    // not a plan-name check.
    if (dto.custom_domain !== undefined) {
      await this.billing.assertFeature(tenantId, 'customDomains');
    }

    const settings = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantSettings.update({
        where: { tenantId },
        data: {
          storeName: dto.store_name,
          currency: dto.currency,
          locale: dto.locale,
          // Changing the domain resets verification.
          ...(dto.custom_domain !== undefined
            ? { customDomain: dto.custom_domain, customDomainVerified: false }
            : {}),
        },
      }),
    );
    return this.toSettingsView(settings);
  }

  /** Replace the product attribute schema after validating it compiles. */
  async setAttributeSchema(tenantId: string, dto: SetAttributeSchemaDto) {
    // Compiling an empty object is a no-op; validate a probe so a broken schema
    // is rejected at configure time, not at the next product write.
    this.attributes.validate(dto.schema, {});

    const settings = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantSettings.update({
        where: { tenantId },
        data: { productAttributeSchema: dto.schema as object },
      }),
    );
    return this.toSettingsView(settings);
  }

  // --- Views (snake_case, no internal columns) -------------------------------
  private toTenantView(t: {
    id: string;
    slug: string;
    name: string;
    status: string;
    settings: unknown;
    subscription: { planKey: string; status: string } | null;
  }) {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan_key: t.subscription?.planKey ?? 'starter',
      subscription_status: t.subscription?.status ?? null,
      settings: t.settings ? this.toSettingsView(t.settings as never) : null,
    };
  }

  private toSettingsView(s: {
    tenantId: string;
    storeName: string;
    currency: string;
    locale: string;
    theme: unknown;
    productAttributeSchema: unknown;
    customDomain: string | null;
    customDomainVerified: boolean;
    draftTheme?: unknown;
    draftRevision?: number;
    publishedRevision?: number;
    publishedAt?: Date | null;
  }, includeDraft = false) {
    const view = {
      tenant_id: s.tenantId,
      store_name: s.storeName,
      currency: s.currency,
      locale: s.locale,
      theme: normalizeStoreDesign(s.theme),
      product_attribute_schema: s.productAttributeSchema ?? {},
      custom_domain: s.customDomain,
      custom_domain_verified: s.customDomainVerified,
    };
    return includeDraft ? {
      ...view,
      draft_theme: normalizeStoreDesign(s.draftTheme),
      draft_revision: s.draftRevision ?? 0,
      published_revision: s.publishedRevision ?? 0,
      published_at: s.publishedAt?.toISOString() ?? null,
    } : view;
  }
}
