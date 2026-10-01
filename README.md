# NEXORA — Everything. One Place.

A mobile-first, installable (PWA) multi-category marketplace for Pakistan, built from the approved
Stitch **Concept 2 — Clean Minimal Marketplace** design.

- **Frontend:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 (Stitch design tokens)
- **Backend:** Supabase — Postgres, Auth, Row Level Security, Storage
- **Areas:** customer storefront · admin dashboard (`/admin`) · rider app (`/rider`)

---

## 1. Setup

### 1.1 Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run these files **in this order** (copy/paste each one and click Run):
   1. `supabase/migrations/20260930000001_schema.sql` — tables and enums
   2. `supabase/migrations/20260930000002_functions.sql` — triggers and RPC functions
   3. `supabase/migrations/20260930000003_rls.sql` — row level security policies
   4. `supabase/migrations/20260930000004_storage.sql` — `product-images` storage bucket
   5. `supabase/migrations/20261001000001_courier_settlement.sql` — couriers, COD and seller settlements
   6. `supabase/migrations/20261002000001_cod_payment_states.sql` — delivered ≠ COD received (COD payment states)
   7. `supabase/seed.sql` — *optional* starter catalogue (categories, brands, products from the Stitch screens, delivery zones, 2 coupons)

   Or with the Supabase CLI: `supabase link` then `supabase db push` and `psql … -f supabase/seed.sql`.

   Every script is idempotent (`if not exists`, `on conflict do nothing`) and never drops data.
   See [`docs/DATABASE.md`](docs/DATABASE.md) for what each table and policy does.

3. **Authentication → URL Configuration:** set *Site URL* to your domain (e.g.
   `https://nexora-ecommerce-phi.vercel.app`) and add `https://your-domain/**` to *Redirect URLs*
   (also `http://localhost:3000/**` for local dev).
4. **Authentication → Providers → Email:** keep enabled with **Confirm email ON**.
5. **Authentication → Email Templates:** paste `supabase/templates/confirm-signup.html` into
   *Confirm signup* and `supabase/templates/reset-password.html` into *Reset password*. These links
   (`/auth/confirm?token_hash=…`) work in whatever browser or app the email is opened in — the
   default Supabase links only sign the user in when opened in the same browser they signed up in.
   Without the templates the app still works: the user is told their email is confirmed and signs in.
6. **Authentication → SMTP Settings:** set up a custom SMTP sender (e.g. Resend, Brevo, Zoho, SES).
   Supabase's built-in sender is for testing only — it is heavily rate-limited and may only deliver
   to your own team's addresses, so customers would not receive confirmation emails.

### 1.2 App

```bash
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:3000
```

Only the **anon** key is used. The service-role key is not needed and must never be put in a
`NEXT_PUBLIC_` variable.

### 1.3 First admin

1. Sign up in the app with the email you want to be admin.
2. In the Supabase SQL editor run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

From then on, manage everything (including making other admins and riders) from `/admin`.

### 1.4 Riders

A rider creates a normal account, then an admin goes to **Admin → Riders**, enters the rider's
email and clicks **Make rider**. Riders open `/rider` and only ever see orders assigned to them.

### 1.5 Before going live

- **Admin → Settings:** support phone/WhatsApp/email and your Easypaisa, JazzCash and bank
  account details (shown to customers at checkout).
- **Admin → Delivery Charges:** review the base charge and zones.
- Replace `public/brand/nexora-logo.svg` / `nexora-mark.svg` with the final logo artwork and run
  `node scripts/generate-icons.mjs` to regenerate the PWA icons.
- Social sharing image: `public/og/nexora-og.png` (regenerate with `node scripts/generate-og.mjs`).
  Set `NEXT_PUBLIC_SITE_URL` to the live domain so Open Graph and canonical URLs are absolute.
- Seed product images point at the Stitch image CDN; upload your own photos from Admin → Products.

---

## 2. Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `supabase/tests/run_local.sh` | Applies all SQL to a throwaway local Postgres and runs the security/workflow tests (needs `psql`; set `PGHOST`/`PGPORT`) |

---

## 3. Architecture

```
src/
  app/
    (tabs)/          header + bottom-nav screens: home, categories, search, cart, account
    (stack)/         pushed screens with back header: product, checkout, orders, wishlist, auth, help
    admin/           admin dashboard (role = admin)
    rider/           rider app (role = rider)
    auth/callback    email links with ?code= (PKCE, same browser)
    auth/confirm     email links with ?token_hash= (any browser; see supabase/templates)
    api/payments/    webhook placeholder for future online gateways
    manifest.ts      PWA manifest
  components/        ui/ layout/ product/ listing/ pdp/ cart/ checkout/ account/ admin/ rider/ providers/
  lib/
    supabase/        browser + server clients, session middleware
    catalog.ts       catalogue queries (server)
    delivery.ts      delivery quote client (rules live in the database)
    payments/        payment method registry + gateway interface
    orders.ts        status labels / tracking steps
public/sw.js         service worker
supabase/            migrations, seed, tests
```

### Security model

- **Row Level Security on every table.** Customers see only their own profile, addresses,
  wishlist, orders, notifications and tickets. Riders see only orders where
  `orders.rider_id = auth.uid()`. Admins (`profiles.role = 'admin'`) see everything.
- **No direct order writes.** Orders are created by `place_order()` and changed by
  `cancel_my_order()`, `admin_update_order_status()`, `admin_assign_rider()`,
  `admin_set_payment_status()` and `rider_update_order()` — `SECURITY DEFINER` functions that
  re-check the caller and validate every transition.
- **Server-side pricing.** `place_order()` re-reads prices and stock from the database, locks
  rows, applies the coupon and delivery rules, and ignores anything the browser sends about price.
- **Role changes** are only possible for admins (trigger `guard_profile_role`), and customers
  can't change their profile email or review author name.

### Delivery charges

`calculate_delivery(province, city, area, subtotal)` in the database is the single source of
truth for the storefront quote, checkout and `place_order()`:

- `fixed` mode → base charge everywhere
- `area` mode → most specific active zone (area → city → province), else base charge
- free delivery over a threshold (optional)
- `distance` mode is reserved (`per_km_rate`, `base_km` columns exist)

### Payments

COD, Easypaisa, JazzCash and Bank Transfer work today (wallet/bank payments are verified by an
admin using the Transaction ID). A delivered COD order is only *COD collected*; it becomes paid when
NEXORA verifies the cash in Shipments & Settlements (see `docs/DATABASE.md`). `src/lib/payments/index.ts` documents how to plug in an online
gateway (card / wallet APIs) via a server route + webhook.

### Courier, COD and seller settlement

Flow: customer → seller's items → courier → **customer pays COD to the courier** → courier remits to
NEXORA's account → admin verifies the COD received → NEXORA commission and courier deductions are
taken → seller payable is credited → admin approves and pays the seller. Sellers never collect COD.

- **Admin → Orders → (order) → Courier & COD:** book a shipment per seller (use the **NEXORA Rider**
  courier for orders your own riders delivered) (courier, tracking
  number, COD amount, courier charges, other deductions, status, delivery date).
- **Admin → Shipments & Settlements:** verify COD (amount received, settlement date, reference),
  approve seller settlements, mark paid with a payment reference, settlement history, couriers,
  default commission, per-seller commission override and linking a seller login to a store.
- **Seller (`/seller`):** read-only total sales, pending/available balance, commission, courier
  deductions, total paid and settlement history. Sellers cannot change any figure (RLS + RPC only).
- Commission (percent or fixed, default + per seller) and courier charges are configured by the
  admin — nothing is hard-coded. Figures are computed in the database and frozen once approved.
- Seller payable = seller's items total − courier deductions − NEXORA commission. Coupon discounts
  and the customer delivery fee are NEXORA's, not the seller's.
- Courier APIs (TCS, Leopards, M&P, Trax…) are not integrated yet; `couriers.code` and
  `src/lib/settlement.ts` (`CourierIntegration`) are the extension points. Keep API keys in server
  environment variables only.

### Multi-vendor ready

Products belong to a `vendor` (store). All current stores are managed by admins; `vendors.owner_id`
and the `vendor` role exist so seller accounts can be added later. Order items keep `vendor_id`
so orders can be split per seller.

### PWA

Manifest (standalone, NEXORA name/icons, shortcuts), service worker with navigation preload,
offline fallback page, "Install NEXORA App" strip (with iOS instructions) and offline banner.
The app can later be wrapped for Google Play as a Trusted Web Activity (e.g. with Bubblewrap)
using the same manifest.

---

## 4. Testing

- `supabase/tests/rls_and_rpc_tests.sql` — 11 scenarios: anon access, role escalation, price
  tampering, stock reservation, coupons, cross-customer isolation, rider isolation, rider workflow,
  reviews, cancellation/restock.
- The app was exercised end-to-end (sign-up, cart, coupon, checkout, admin order handling,
  product creation, rider delivery, offline mode) against a local Supabase-compatible stack
  (Postgres + GoTrue + PostgREST) and checked at 360 / 768 / 1280 px widths.
