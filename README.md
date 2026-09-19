# ecom-saas

A multi-tenant commerce platform. Each seller registers a workspace and gets an isolated admin
dashboard (catalog, inventory, orders, customers, payments, marketing, team & roles) plus their own
public storefront. A separate platform-admin console reviews and manages all workspaces.

| Part | Stack | Docs |
|---|---|---|
| [`backend/`](backend) | NestJS, Prisma, PostgreSQL | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend) | Next.js (App Router), Tailwind v4, shadcn/ui (Base UI) | [frontend/README.md](frontend/README.md) |

## Features

- **Workspaces & auth** — password or OAuth (Google, Microsoft, Facebook) signup, rotating refresh
  tokens, password reset, RBAC with custom roles, audit log. Legal name required; GSTIN / PAN
  validated. OAuth signups finish business and tax details on an onboarding step.
- **Catalog & inventory** — products with variants, CSV import/export, stock adjustments, low- and
  out-of-stock alerts.
- **Orders** — `PENDING → CONFIRMED → SHIPPED → FULFILLED` (or cancelled) with tracking, stock
  deduction/restock, returns and refunds, GST invoices (PDF).
- **Storefront** — per-tenant public store with offers, reviews, cart and Razorpay checkout;
  customers can track orders by ID + email.
- **Payments & billing** — Razorpay for orders, subscription plans, referral commissions with
  UPI payouts.
- **Notifications** — in-app bell, email (Resend), WhatsApp with SMS fallback (Twilio); marketing
  campaigns with unsubscribe links.
- **Platform admin** — cross-tenant review workflow (approve / reject / request changes / suspend)
  and analytics.

## Quick start

Prerequisites: Node.js 20+, pnpm, Docker (for Postgres).

```bash
# 1. Backend  → http://localhost:4000  (Swagger at /docs)
cd backend
docker compose up -d
cp .env.example .env            # set DATABASE_URL and the three JWT secrets (openssl rand -base64 48)
pnpm install
pnpm prisma:migrate
pnpm start:dev

# 2. Frontend → http://localhost:3000   (in a second terminal)
cd frontend
pnpm install
pnpm dev
```

Then open <http://localhost:3000/register> to create a workspace. To use the platform-admin console
(`/platform-admin`), create the first admin once:

```bash
cd backend
PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='...' pnpm seed:platform-admin
```

Only the database and JWT secrets are required. Payments, email, WhatsApp/SMS and OAuth are
optional: each stays disabled with a clear message until its credentials are set in
`backend/.env` (see the configuration table in the backend README). For example, password-reset
and order emails only send once `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set.

## How it fits together

- **Tenant isolation** — every tenant-scoped query goes through `PrismaService.forTenant()`.
  Permissions are checked on every request (deny by default) and re-read from the database, not
  trusted from the token.
- **Which store `/store` shows** — a signed-in seller sees their own store; `/store?store=<slug>`
  shows a specific tenant's public store (active tenants only); anonymous visitors with no slug get
  the optional `STOREFRONT_TENANT_SLUG` fallback. Details in the frontend README.
- **Sessions** — the access token lives in memory only; an httpOnly refresh cookie restores it
  after a reload.

## Development

```bash
cd backend  && pnpm test && npx tsc --noEmit    # unit tests + typecheck
cd frontend && npx tsc --noEmit && pnpm lint    # typecheck + lint
```

Schema changes need a new Prisma migration (`pnpm prisma:migrate`); never edit one that has
already been applied. Never commit `.env` files or real credentials.

## Status

Not built yet: email verification on signup, team invites, multi-warehouse inventory. See each
README's "Not built yet" section and the `ponytail:` comments in the code for deliberate
shortcuts and their upgrade paths.
