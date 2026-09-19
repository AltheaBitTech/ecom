# ecom-saas backend

NestJS + Prisma + PostgreSQL. Multi-tenant commerce backend: tenant registration (password or
OAuth), argon2id auth with rotating refresh tokens, RBAC, strict tenant isolation, audit log,
catalog, inventory, orders, a public per-tenant storefront, Razorpay payments, GST invoices,
subscription billing, referrals, notifications (in-app / email / WhatsApp / SMS), marketing
campaigns, and a cross-tenant platform-admin API. Swagger docs at `/docs` (non-production only).

## Run locally

```bash
docker compose up -d          # Postgres on :5432
cp .env.example .env          # then fill in the secrets below
                               # generate each secret with: openssl rand -base64 48
pnpm install
pnpm prisma:migrate           # applies migrations, creates the DB
pnpm seed:plans               # optional: example subscription plans
pnpm start:dev                # http://localhost:4000

# One-time: create the first platform (cross-tenant super-admin) account
PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='...' pnpm seed:platform-admin
```

| Command | What it does |
|---|---|
| `pnpm start:dev` | Watch mode on :4000 |
| `pnpm build` | Compile to `dist/` |
| `pnpm test` | Jest unit suite |
| `pnpm prisma:migrate` / `prisma:deploy` | Create+apply (dev) / apply only (prod) migrations |
| `pnpm seed:plans`, `seed:platform-admin` | One-off seeds |
| `scripts/storefront-smoke.ts` | Integration check in a disposable tenant (`--keep` for browser QA, then `--cleanup`) |

## Configuration

Everything except the database and JWT secrets is optional: an unset integration returns a
clear error from *its* feature and never stops the app booting.

| Group | Variables | Notes |
|---|---|---|
| Core | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PLATFORM_JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `PORT` | Required: DB + the three secrets |
| URLs | `FRONTEND_URL`, `BACKEND_URL` | Used for OAuth callbacks and links in emails |
| Storefront | `STOREFRONT_TENANT_SLUG` | Fallback store for a bare `/store` visit only — see [Storefront](#storefront) |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAYX_ACCOUNT_NUMBER` | Last one enables automatic referral payouts |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | From address must be on a domain verified in Resend |
| WhatsApp / SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` | WhatsApp first, SMS as fallback |
| OAuth | `GOOGLE_*`, `MICROSOFT_*`, `FACEBOOK_*`, `TWITTER_*` (`_CLIENT_ID` / `_CLIENT_SECRET`) | Redirect URI per provider: `${BACKEND_URL}/auth/oauth/<provider>/callback` |

## Authentication

- **Password signup**: `POST /auth/register` creates a tenant + Owner user and seeds system roles
  (Tenant Owner, Tenant Administrator, Analyst). Business name, email, password, and **legal
  name are required**; GSTIN / PAN are optional but validated (format + GSTIN checksum).
  Password rules: 12–128 chars, at least 3 of lowercase / uppercase / digit / symbol.
- **OAuth signup and login** (Google, Microsoft, Facebook): `GET /auth/oauth/:provider?mode=register`
  creates a workspace whose Owner has no password and is bound to that provider; the user then
  completes business, legal name and tax details on the frontend `/onboarding` page.
  `?tenantSlug=<slug>` signs into an existing workspace. An account can only sign in with the
  provider it signed up with (others are told which one). Google emails must be provider-verified.
  X (Twitter) never shares an email, so it cannot sign up (login fails closed).
  The OAuth `state` is a signed 10-minute JWT carrying the mode (and the PKCE verifier).
- **Sessions**: short-lived access token (memory only on the client) + rotating httpOnly refresh
  cookie. `POST /auth/login` (`tenantSlug` + email + password), `/auth/refresh`, `/auth/logout`, `GET /auth/me`.
- **Password reset**: `POST /auth/forgot-password` (identical response whether or not the email
  exists; password accounts only) emails a link; `POST /auth/reset-password` sets the new password
  and revokes every session. The link is a stateless 30-minute token bound to the current password
  hash (signed with a derived key), so it works once and can't be replayed as an access token.
- Permissions are re-read from the DB on every request, not cached in the JWT, so a suspension or
  role change applies on the next request.
- Every non-`@Public()` route requires `@RequirePermissions(...)` (deny by default).
  Auth endpoints are rate limited. Platform routes use a separate identity and JWT.

## Tenant isolation

`PrismaService.forTenant(tenantId)` is the chokepoint every tenant-scoped query must go through
(see the comment in `src/common/prisma/prisma.service.ts` for what it enforces and its limits).
Public endpoints that have no logged-in tenant (storefront, public order lookup) resolve the tenant
explicitly and never return internal ids.

## Modules and endpoints

- **Auth / users / roles**: routes above, plus `GET /users`, `POST /users/:id/suspend`, and
  `GET/POST/PATCH/DELETE /roles` (+ `/clone`, `/archive`; custom roles are bounded by the creator's
  own permissions).
- **Tenants**: `PATCH /tenants/me/tax-info` — business `name`, legal name, GSTIN, PAN, billing
  address, logo (HTTPS), home state for GST place-of-supply.
- **Catalog**: products with variants and publish/unpublish/archive, CSV import/export.
  `GET /products` accepts `category`, `search`, `status`, `sortBy`, `sortDir`, `includeArchived`.
- **Inventory**: `GET /inventory`, `POST /inventory/:productId/adjust` (signed delta; can't go negative).
- **Orders**: customers, orders with price snapshots, and the lifecycle
  `PENDING → CONFIRMED → SHIPPED → FULFILLED` (or `CANCELLED`). Confirming deducts stock for every
  line in one transaction; cancelling a confirmed order restocks. `/ship` takes `trackingNumber` and
  `courierName`. Invalid transitions return 409. CSV export, returns/refund requests.
  `GET /orders/public/:id?email=` is the customer-facing tracking lookup (email must match).
- **Invoices**: GST invoice generation and PDF download (admin and customer).
- **Payments**: `POST /orders/:id/payment` creates a Razorpay order; `POST /payments/webhook`
  (signature-verified) marks it paid/failed.
- **Billing**: plans, subscribe / change plan, Razorpay webhook.
- **Referrals**: referral codes, commissions, UPI payout VPA; platform-side commission payout.
- **Marketing**: audience preview and campaigns over email / WhatsApp / SMS, every message with an
  unsubscribe link.
- **Platform** (`/platform/*`): separate `PlatformAdmin` identity (created only via
  `seed:platform-admin`); tenant review workflow (approve / reject / request revision / suspend /
  reactivate), overview analytics, referral payouts.

### Storefront

Each tenant has its own public store. Public calls (`GET /storefront`, `/products`, `/quote`,
`/checkout`, `/verify-payment`, `/reviews`) name the store with the `x-store-slug` header (the
frontend sends it from `?store=<slug>`). Only `ACTIVE` tenants are served publicly. With no header,
`STOREFRONT_TENANT_SLUG` is the fallback for anonymous visitors; leave it empty for no default
store. Signed-in sellers preview their own store, whatever its status, via
`GET /storefront/admin/preview`. `/storefront/admin/*` covers settings, offers, review moderation
and analytics.

## Notifications

| Channel | Recipients | Requires |
|---|---|---|
| In-app bell | Team members (permission-aware), always written | — |
| Email (Resend) | Customers; team members who haven't opted out | `RESEND_*` |
| WhatsApp → SMS fallback (Twilio) | Customers with a phone | `TWILIO_*` |

- **Customers**: order placed / confirmed / shipped (with tracking) / fulfilled / cancelled,
  payment received or failed, return decision, invoice ready.
- **Team**: new order, order cancelled, payment result, return requested, new review to moderate,
  low / out-of-stock (once per threshold crossing), subscription events, workspace approval /
  rejection / changes requested.
- **Account**: welcome email on signup, password-reset link.

Sending is fire-and-forget: a channel failure is logged and never fails the operation that triggered
it. Without credentials, email/WhatsApp/SMS are skipped and only the in-app bell works.

## Not built yet

Email verification on signup; multi-warehouse inventory (one `InventoryItem` per product today);
refresh-token rotation for platform admins; team invites. Look for `ponytail:` comments in the
code for each deliberate shortcut and its upgrade path.
