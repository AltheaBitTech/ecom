/**
 * Seed — idempotent baseline data.
 *
 *   npm run db:seed
 *
 * Creates:
 *   * Subscription plans (starter/pro/enterprise). Plans are DATA, not code:
 *     feature flags and usage limits live here and are read via hasFeature()/limitFor().
 *   * The permission catalog (from PERMISSION_CATALOG — the single source of truth).
 *   * The platform-default system role templates (Admin/Contributor/Reader,
 *     tenant_id NULL), derived from the catalog, which provisioning clones per store.
 *   * An optional platform Super Admin, so the platform endpoints are usable day one.
 *
 * Re-running is safe: everything upserts on a natural key. Runs as the privileged
 * DIRECT_URL role because it writes NULL-tenant templates and global identity rows.
 */
import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { PrismaClient, PlatformRole, AuthProvider } from '@prisma/client';
import * as argon2 from 'argon2';

import { resolveDefaultRoles } from '../src/common/rbac/default-roles';
import { PERMISSION_CATALOG } from '../src/modules/permissions/permission-catalog';

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });

// -1 means unlimited. Feature keys are read only via hasFeature(tenant, key).
// `dedicatedDb` drives the isolation tier: enterprise tenants may be provisioned
// onto a dedicated database (see Tenant.isolationTier).
const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    priceCents: 0,
    position: 0,
    features: { analytics: false, customDomains: false, giftCards: false, dedicatedDb: false, premiumStorefrontTemplates: false, exclusiveStorefrontTemplates: false },
    limits: { products: 50, staffSeats: 2, customDomains: 0, mediaBytes: 262_144_000 },
  },
  {
    key: 'pro',
    name: 'Pro',
    priceCents: 4900,
    position: 1,
    features: { analytics: true, customDomains: true, giftCards: false, dedicatedDb: false, premiumStorefrontTemplates: true, exclusiveStorefrontTemplates: false },
    limits: { products: 1000, staffSeats: 10, customDomains: 1, mediaBytes: 5_368_709_120 },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceCents: 29900,
    position: 2,
    features: { analytics: true, customDomains: true, giftCards: true, dedicatedDb: true, premiumStorefrontTemplates: true, exclusiveStorefrontTemplates: true },
    limits: { products: -1, staffSeats: -1, customDomains: -1, mediaBytes: 26_843_545_600 },
  },
];

// Argon2id + pepper, mirroring src/common/crypto/password.service.ts. Kept inline
// so the seed has no dependency on the compiled Nest app.
const PEPPER = process.env.PASSWORD_PEPPER ?? 'change-me-to-a-long-random-string-in-every-environment';
const PEPPER_VERSION = Number(process.env.PASSWORD_PEPPER_VERSION ?? '1');

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain + PEPPER, { type: argon2.argon2id });
}

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        priceCents: plan.priceCents,
        position: plan.position,
        features: plan.features,
        limits: plan.limits,
      },
      create: plan,
    });
  }
  // eslint-disable-next-line no-console
  console.warn(`Seeded ${PLANS.length} subscription plans.`);
}

async function seedPermissionsAndRoleTemplates(): Promise<void> {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: { key: perm.key, description: perm.description },
    });
  }

  const catalog = await prisma.permission.findMany();
  const catalogKeys = catalog.map((p) => p.key);
  const byKey = new Map(catalog.map((p) => [p.key, p.id]));

  // Platform-default role templates, DERIVED from the catalog — no hardcoding.
  for (const roleDef of resolveDefaultRoles(catalogKeys)) {
    // Prisma forbids NULL in a compound unique `where`, so system-role templates
    // (tenant_id NULL) are matched with findFirst, then created if absent.
    const role =
      (await prisma.role.findFirst({ where: { tenantId: null, name: roleDef.name } })) ??
      (await prisma.role.create({
        data: {
          tenantId: null,
          name: roleDef.name,
          isSystemRole: true,
          grantOnProvision: roleDef.grantOnProvision,
          isProtected: roleDef.isProtected,
        },
      }));

    // Keep flags in sync on re-seed (idempotent).
    await prisma.role.update({
      where: { id: role.id },
      data: { grantOnProvision: roleDef.grantOnProvision, isProtected: roleDef.isProtected },
    });

    for (const key of roleDef.permissionKeys) {
      const permissionId = byKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.warn(`Seeded ${PERMISSION_CATALOG.length} permissions and 3 default role templates.`);
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@yourplatform.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
  const generated = !process.env.SEED_SUPER_ADMIN_PASSWORD;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Platform Super Admin',
      emailVerified: true,
      passwordHash: await hashPassword(password),
      passwordPepperVersion: PEPPER_VERSION,
    },
  });

  await prisma.userIdentity.upsert({
    where: { provider_providerUserId: { provider: AuthProvider.PASSWORD, providerUserId: user.id } },
    update: {},
    create: { userId: user.id, provider: AuthProvider.PASSWORD, providerUserId: user.id, emailAtLink: email },
  });

  await prisma.platformAdmin.upsert({
    where: { userId: user.id },
    update: { role: PlatformRole.SUPER_ADMIN },
    create: { userId: user.id, role: PlatformRole.SUPER_ADMIN },
  });

  // eslint-disable-next-line no-console
  console.warn(`Seeded Super Admin: ${email}`);
  if (generated) {
    // eslint-disable-next-line no-console
    console.warn(`  Generated password (shown once): ${password}`);
  }
}

async function main(): Promise<void> {
  await seedPlans();
  await seedPermissionsAndRoleTemplates();
  await seedSuperAdmin();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
