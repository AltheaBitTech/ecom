# ecom-saas frontend

Next.js (App Router) + Tailwind v4 + shadcn/ui (Base UI primitives, "Nova" preset).

## Run locally

```bash
# optional: .env.local with NEXT_PUBLIC_API_URL=http://localhost:4000 (that's the default)
pnpm install
pnpm dev                      # http://localhost:3000
pnpm build && pnpm start      # production build
pnpm lint
```

Needs the backend running (`../backend`, `pnpm start:dev`) with `CORS_ORIGINS` including
`http://localhost:3000` (the default in the backend `.env.example`).

## What's here

- **Public site** (`src/app/(marketing)`) — landing page, legal pages, dark/light theme.
- **Auth** (`src/app/(auth)`)
  - `/register` — workspace signup with live validation (password rule checklist, legal name
    required, GSTIN / PAN checked as you type) and "sign up with" Google / Microsoft / Facebook.
  - `/onboarding` — second step for OAuth signups: business name, legal name (required), GSTIN, PAN.
    `/admin` redirects here until the workspace has a legal name.
  - `/login` (password or provider), `/forgot-password`, `/reset-password`.
- **Admin dashboard** (`src/app/admin`) — sidebar shell gated by `useAuth()`: Overview, Analytics,
  Products (variants, CSV import/export, publish/archive), Storefront & offers, Inventory, Orders
  (status changes, tracking, returns, invoices, CSV), Customers, Payments, Marketing campaigns,
  Users, Roles, Settings (tax info, billing/plans, referrals, notification preferences), and a
  notification bell. Nav items and actions are hidden when the user lacks the permission, mirroring
  the backend's `@RequirePermissions` (the backend is the real enforcement point).
- **Storefront** (`src/app/(storefront)`) — per-tenant public store: `/store`, products, offers,
  cart, checkout (Razorpay), order confirmation, order tracking (`/orders/:id`), returns, reviews.
- **Platform admin** (`src/app/(platform)/platform-admin`) — cross-tenant console with its own
  login (BFF routes in `src/app/api/platform`, httpOnly cookie): overview, tenant review workflow.

## Which store does `/store` show?

- Signed-in seller, bare `/store` → **their own** store (authenticated preview; checkout disabled).
  Admin → Storefront → *Preview store* opens the same view.
- `/store?store=<slug>` → that tenant's public store (only `ACTIVE` tenants). The slug is carried
  through store links, cart and checkout (`StoreLink` / `useStoreHref`) and sent to the API as the
  `x-store-slug` header.
- Anonymous, bare `/store` → the backend's `STOREFRONT_TENANT_SLUG` fallback, if set.

## Auth model

The access token lives in memory only (`src/lib/api.ts`), never `localStorage`. A hard refresh has
none, so `AuthProvider` (`src/lib/auth-context.tsx`) silently calls `POST /auth/refresh` (httpOnly
cookie) on mount, then `GET /auth/me` for the live permission set; `reload()` re-fetches it (used
after onboarding). `api()` retries once through the same refresh flow on any 401. OAuth sign-in
sets the refresh cookie on the callback redirect, so the same restore path picks it up.

## Validation

Signup, onboarding and reset forms validate live, mirroring backend rules (shared in
`src/lib/form-validation.ts` and `src/lib/tax-validation.ts`; keep them in sync with the DTOs and
`AuthService`). The backend re-validates everything.

## Not built yet

Email verification screens, and team invites (no backend counterpart yet).
