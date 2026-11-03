/**
 * Cross-tenant isolation release gate — the security-critical, blocking CI check.
 *
 * This suite proves the DATABASE layer of defense directly: connecting as the
 * NON-superuser runtime role (DATABASE_URL, exactly as the app does), row-level
 * security must return ZERO rows when no tenant context is set, and only the
 * scoped tenant's rows when a context is set. It asserts isolation fails CLOSED.
 *
 * The HTTP guard layer (token tenant boundary) is covered deterministically by
 * src/common/auth/authorization.guard.spec.ts.
 *
 * Requires local infra up, migrated and secured:
 *   npm run infra:up && npm run db:migrate && npm run db:security
 *   npm run test:isolation
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const RUN = process.env.ISO_RUN ?? 'iso';
const tenantA = `${RUN}-tenant-a`;
const tenantB = `${RUN}-tenant-b`;
const systemRole = `${RUN}-system-role`; // a NULL-tenant template, readable by all tenants

// Seed a tenant + settings + one active product, plus the identity rows folded
// in from the former auth-rbac-service (a global user, a scoped customer, a
// scoped role and the membership joining them). All under an RLS bypass as owner.
async function seedTenant(owner: PrismaClient, id: string): Promise<void> {
  await owner.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
       VALUES ($1, $1, $1, 'ACTIVE', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      id,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO tenant_settings (tenant_id, store_name, currency, locale, theme, product_attribute_schema, custom_domain_verified, created_at, updated_at)
       VALUES ($1, $1, 'USD', 'en', '{}', '{}', false, now(), now())
       ON CONFLICT (tenant_id) DO NOTHING`,
      id,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO products (id, tenant_id, name, slug, description, status, price_cents, currency, stock, images, custom_attributes, created_at, updated_at)
       VALUES ($2, $1, 'Widget', 'widget', NULL, 'ACTIVE', 100, 'USD', 5, '[]', '{}', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      id,
      `${id}-prod`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO media_assets (id, tenant_id, object_key, filename, mime_type, size_bytes, status, created_at, updated_at)
       VALUES ($2, $1, $3, 'hero.webp', 'image/webp', 128, 'READY', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      id,
      `${id}-media`,
      `tenants/${id}/storefront/hero.webp`,
    );
    // Global user (users is NOT an RLS table) — the membership's subject.
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, email_verified, created_at, updated_at, metadata)
       VALUES ($1, $2, true, now(), now(), '{}')
       ON CONFLICT (id) DO NOTHING`,
      `${id}-user`,
      `${id}@example.test`,
    );
    // Per-tenant shopper.
    await tx.$executeRawUnsafe(
      `INSERT INTO customers (id, tenant_id, email, email_verified, status, created_at, updated_at, metadata)
       VALUES ($2, $1, $3, true, 'ACTIVE', now(), now(), '{}')
       ON CONFLICT (id) DO NOTHING`,
      id,
      `${id}-cust`,
      `shopper@${id}.test`,
    );
    // Per-tenant role + the membership joining the user to it.
    await tx.$executeRawUnsafe(
      `INSERT INTO roles (id, tenant_id, name, is_system_role, grant_on_provision, is_protected, created_at, updated_at)
       VALUES ($2, $1, 'Admin', false, false, false, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      id,
      `${id}-role`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO user_tenant_roles (id, user_id, tenant_id, role_id, type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'STAFF', 'ACTIVE', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      `${id}-utr`,
      `${id}-user`,
      id,
      `${id}-role`,
    );
  });
}

// Seed one NULL-tenant system-role template (Admin/Contributor/Reader are cloned
// from rows like this at provision time — every tenant must be able to READ it).
async function seedSystemRole(owner: PrismaClient): Promise<void> {
  await owner.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
    await tx.$executeRawUnsafe(
      `INSERT INTO roles (id, tenant_id, name, is_system_role, grant_on_provision, is_protected, created_at, updated_at)
       VALUES ($1, NULL, 'IsoSystemTemplate', true, false, false, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      systemRole,
    );
  });
}

async function cleanup(owner: PrismaClient, id: string): Promise<void> {
  await owner.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
    // Deleting the tenant cascades its customers/roles/memberships; the global
    // user and the NULL-tenant template are not tenant-owned, so drop them too.
    await tx.$executeRawUnsafe(`DELETE FROM tenants WHERE id = $1`, id);
    await tx.$executeRawUnsafe(`DELETE FROM users WHERE id = $1`, `${id}-user`);
    await tx.$executeRawUnsafe(`DELETE FROM roles WHERE id = $1`, systemRole);
  });
}

describe('Cross-tenant isolation (release gate)', () => {
  let owner: PrismaClient;
  let runtime: PrismaClient;

  beforeAll(async () => {
    owner = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
    runtime = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    await seedTenant(owner, tenantA);
    await seedTenant(owner, tenantB);
    await seedSystemRole(owner);
  });

  afterAll(async () => {
    await cleanup(owner, tenantA);
    await cleanup(owner, tenantB);
    await owner.$disconnect();
    await runtime.$disconnect();
  });

  it('products: no tenant context returns zero rows (fails closed)', async () => {
    const rows = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM products WHERE id IN ($1, $2)`,
      `${tenantA}-prod`,
      `${tenantB}-prod`,
    );
    expect(rows).toHaveLength(0);
  });

  it('products: a tenant context reveals ONLY that tenant’s rows', async () => {
    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantA);
      return tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(`SELECT tenant_id FROM products`);
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.tenant_id === tenantA)).toBe(true);
  });

  it('tenants: no context returns zero rows; a context reveals only its own', async () => {
    const withoutContext = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE id IN ($1, $2)`,
      tenantA,
      tenantB,
    );
    expect(withoutContext).toHaveLength(0);

    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantB);
      return tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM tenants`);
    });
    expect(scoped.map((r) => r.id)).toEqual([tenantB]);
  });

  it('customers: no context returns zero rows; a context reveals only its own', async () => {
    const withoutContext = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM customers WHERE id IN ($1, $2)`,
      `${tenantA}-cust`,
      `${tenantB}-cust`,
    );
    expect(withoutContext).toHaveLength(0);

    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantA);
      return tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(`SELECT tenant_id FROM customers`);
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.tenant_id === tenantA)).toBe(true);
  });

  it('media_assets: no context returns zero rows; a context reveals only its own', async () => {
    const withoutContext = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM media_assets WHERE id IN ($1, $2)`,
      `${tenantA}-media`,
      `${tenantB}-media`,
    );
    expect(withoutContext).toHaveLength(0);

    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantB);
      return tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(`SELECT tenant_id FROM media_assets`);
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((row) => row.tenant_id === tenantB)).toBe(true);
  });

  it('user_tenant_roles: no context returns zero rows; a context reveals only its own', async () => {
    const withoutContext = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM user_tenant_roles WHERE id IN ($1, $2)`,
      `${tenantA}-utr`,
      `${tenantB}-utr`,
    );
    expect(withoutContext).toHaveLength(0);

    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantB);
      return tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(`SELECT tenant_id FROM user_tenant_roles`);
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.tenant_id === tenantB)).toBe(true);
  });

  it('roles: a tenant reads NULL-tenant templates + its own, never another tenant’s', async () => {
    const scoped = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantA);
      return tx.$queryRawUnsafe<Array<{ id: string; tenant_id: string | null }>>(
        `SELECT id, tenant_id FROM roles WHERE id IN ($1, $2, $3)`,
        `${tenantA}-role`,
        `${tenantB}-role`,
        systemRole,
      );
    });
    const ids = scoped.map((r) => r.id).sort();
    // Sees its own role and the shared template; the foreign tenant's role is hidden.
    expect(ids).toEqual([systemRole, `${tenantA}-role`].sort());
  });

  it('roles: a tenant CANNOT write a NULL-tenant (system template) role', async () => {
    // USING admits NULL-tenant templates for reading, but WITH CHECK still
    // requires tenant_id = current_tenant — so a tenant can never forge a template.
    await expect(
      runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantA);
        await tx.$executeRawUnsafe(
          `INSERT INTO roles (id, tenant_id, name, is_system_role, grant_on_provision, is_protected, created_at, updated_at)
           VALUES ($1, NULL, 'ForgedTemplate', true, false, false, now(), now())`,
          `${RUN}-forged-template`,
        );
      }),
    ).rejects.toBeTruthy();
  });

  it('writes: the runtime role cannot INSERT a row for a foreign tenant', async () => {
    // With tenantA context set, an attempt to write a tenantB row must be
    // blocked by the policy's WITH CHECK clause.
    await expect(
      runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantA);
        await tx.$executeRawUnsafe(
          `INSERT INTO products (id, tenant_id, name, slug, status, price_cents, currency, stock, images, custom_attributes, created_at, updated_at)
           VALUES ($1, $2, 'Sneaky', 'sneaky', 'ACTIVE', 1, 'USD', 1, '[]', '{}', now(), now())`,
          `${RUN}-cross`,
          tenantB,
        );
      }),
    ).rejects.toBeTruthy();
  });
});
