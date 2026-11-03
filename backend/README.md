# ecom backend

Category-agnostic, multi-tenant e-commerce API — **standalone**. It owns both
identity (staff, shoppers, roles, permissions, MFA, sessions) and the commerce
domain (catalog, orders, per-tenant settings and billing) in one service, one
database, one deploy, behind PostgreSQL **row-level security**.

> Identity was folded in as **milestone 1** (see the plan). There is no separate
> auth service: ecom signs its own RS256 tokens and serves its own JWKS at
> `/.well-known/jwks.json`. `auth-rbac-service/` remains in the repo for
> reference only and is not part of the running stack.

## Identity, owned natively

| Concern | Mechanism |
| --- | --- |
| Staff / shopper login, MFA, sessions | RS256 JWT signed here; refresh rotation + reuse detection |
| Roles & permission catalog | seeded from `PERMISSION_CATALOG`; `products:*`, `store_settings:*`, … |
| Tenant + owner creation | `POST /v1/onboarding/provision` — one in-process transaction (`X-Internal-Key`) |
| Token verification | in-process over the local `JwtService` (no network hop) |
| Catalog / orders / settings / billing | own Postgres + RLS |

A local `Tenant.id` (`cuid()`) is embedded as the token's `tenant_id`, so identity
and commerce data line up on one identifier.

## Nothing hardcoded

- **Products** carry core fields (name, price, images, stock) plus a
  `custom_attributes` JSON blob validated on every write against the tenant's own
  **JSON Schema** (`TenantSettings.productAttributeSchema`). A grocery store
  requires `expiry_date`; an apparel store requires `size`/`color` — with zero
  category-specific code. See `catalog/attribute-validator.service.ts`.
- **Feature/limit gating** reads the tenant's `Plan` row through a single
  `BillingService.hasFeature()` / `assertWithinLimit()` — no plan-name
  conditionals anywhere.
- **Roles/permissions** are enforced by `@RequirePermission('resource:action')`
  against the caller's resolved set — never a role-name check.
- **Theme** is admin data (`TenantSettings.theme`), served to the storefront to
  render dynamically.

## Security model

- **RLS everywhere.** Every tenant-owned table is `FORCE ROW LEVEL SECURITY`,
  keyed on `app.current_tenant`. The runtime role (`ecom_rls`) is a non-superuser;
  the owner role (`DIRECT_URL`) is used only for migrations, RLS bootstrap and
  seed. Missing context ⇒ zero rows (fails closed). See `prisma/rls.sql`.
- **Two layers of tenant isolation:** the `AuthorizationGuard` rejects a token
  whose `tenant_id` ≠ the `:tenantId` path param (`tenant_boundary_violation`),
  on top of RLS. Both are asserted by the isolation gate.
- **Guard chain:** `ThrottlerGuard` → `AuthenticationGuard` → `AuthorizationGuard`.
- **Config validated at boot** (`env.validation.ts`); the process refuses to
  start on a bad value, and won't boot in production with any secret still at its
  dev placeholder (pepper, internal key, encryption key) or an insecure cookie.

## Run it

```bash
# 0. Install
npm install

# 1. Start Postgres + Redis (ports 5433 / 6380 to sit beside other local stacks)
npm run infra:up

# 2. Configure — defaults work for local dev
cp .env.example .env

# 3. Generate the RS256 signing keypair (writes gitignored ./keys)
npm run keys:generate

# 4. Schema (owner), then the runtime role + RLS (owner), then seed
npm run db:migrate
npm run db:security
npm run db:seed              # plans, permission catalog, role templates, super admin

# 5. Run
npm run start:dev            # http://localhost:4001,  Swagger at /docs
```

Tenant provisioning is a single in-process transaction gated by `INTERNAL_API_KEY`
— no external service to configure. Everything (identity, storefront reads,
catalog under a valid token) runs against this service alone.

## Verify

```bash
npm run build            # emits dist/main.js
npm run lint             # clean across src + test
npm test                 # guard unit specs (no infra)
npm run test:isolation   # cross-tenant RLS gate (needs infra up + migrated + secured)
```

The isolation gate is the **blocking** check: it proves the runtime role sees
zero rows without a tenant context, only the scoped tenant's rows with one, and
cannot write a row for a foreign tenant.

## Endpoint map (v1)

| Route | Credential | Notes |
| --- | --- | --- |
| `GET /healthz`, `/readyz` | none | probes (version-less) |
| `POST /v1/onboarding/provision` | `X-Internal-Key` | create store + owner |
| `GET/PATCH /v1/tenants/:tenantId/settings` | staff `store_settings:*` | config + theme |
| `PUT /v1/tenants/:tenantId/settings/attribute-schema` | staff `store_settings:write` | define product attributes |
| `GET /v1/tenants/:tenantId/billing/entitlements` | staff | plan features/limits |
| `… /v1/tenants/:tenantId/products` (CRUD) | staff `products:*` | catalog admin |
| `… /v1/tenants/:tenantId/categories` (CRUD) | staff `products:*` | categories |
| `GET /v1/storefront/:tenantId/products` | none | ACTIVE products only |
| `GET /v1/storefront/:tenantId/config` | none | theme + attribute schema |

Permission keys (`products:read/write`, `store_settings:read/write`, …) are
defined in `PERMISSION_CATALOG` — the single source of truth this service owns —
and seeded into the local `Permission` table.
