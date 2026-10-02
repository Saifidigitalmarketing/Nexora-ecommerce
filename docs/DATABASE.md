# NEXORA database — what the SQL does

The repository had no existing database, so everything below is **new**. Nothing is dropped or
rewritten; every statement uses `if not exists` / `on conflict do nothing` / `create or replace`.
Review the files, then run them in the Supabase SQL editor in this order:

1. `supabase/migrations/20260930000001_schema.sql`
2. `supabase/migrations/20260930000002_functions.sql`
3. `supabase/migrations/20260930000003_rls.sql`
4. `supabase/migrations/20260930000004_storage.sql`
5. `supabase/migrations/20261001000001_courier_settlement.sql`
6. `supabase/migrations/20261002000001_cod_payment_states.sql`
7. `supabase/migrations/20261003000001_order_shipment_sync.sql`
8. `supabase/seed.sql` (optional starter data)

## Tables

| Table | Why it exists | Key fields |
| --- | --- | --- |
| `profiles` | One row per signed-up user (created by trigger from `auth.users`) | `full_name`, `phone`, `whatsapp`, `email`, `role` (`customer` / `admin` / `rider` / `vendor`) |
| `vendors` | Stores that sell products (multi-vendor ready) | `name`, `slug`, `badge`, `is_official`, `owner_id` (future sellers) |
| `brands` | Brand filter + "Official Brand Flagships" row | `name`, `slug`, `logo_url`, `icon`, `short_code`, `is_featured` |
| `categories` | Categories and subcategories | `parent_id`, `name`, `slug`, `icon`, `sort_order`, `is_active` |
| `products` | Catalogue | `price`, `compare_at_price`, `stock`, `badges[]`, `specs` (json), `tags[]`, `is_featured`, `is_flash_deal`, `flash_deal_ends_at`, `rating_avg/count`, `sold_count` |
| `product_images` | Ordered product photos | `url`, `sort_order` |
| `product_variants` | Purchasable options (colour, storage, size) | `options` (json), `color_hex`, `price`, `stock` |
| `banners` | Home hero slides | `title`, `image_url`, `cta_link`, schedule |
| `wishlist_items` | Saved products | `user_id`, `product_id` |
| `addresses` | Saved delivery addresses | province, city, area, address, landmark, postal code, `is_default` |
| `orders` | Orders with customer + address snapshot | totals, `payment_method`, `payment_status`, `payment_reference`, `status`, `rider_id`, ETA |
| `order_items` | Line snapshot (name, variant, price at purchase) | `unit_price`, `quantity`, `vendor_id` |
| `order_status_history` | Tracking timeline | `status`, `note`, `changed_by` |
| `payments` | One row per payment attempt (gateway-ready) | `method`, `provider`, `amount`, `status`, `reference`, `meta` |
| `coupons` / `coupon_redemptions` | Vouchers and who used them | type, value, min order, limits, dates |
| `delivery_settings` | Single row: mode, base charge, ETA, free-delivery threshold, future per-km fields | |
| `delivery_zones` | Area/city/province charges | `charge`, `eta_min_days`, `eta_max_days`, `priority` |
| `riders` | Rider details for profiles with role `rider` | vehicle, CNIC, zone, `is_active` |
| `reviews` | Product reviews; verified-purchase flag set by the database | `rating`, `body`, `is_approved` |
| `notifications` | In-app notifications (order updates) | `title`, `body`, `link`, `is_read` |
| `support_tickets` | Help & Support messages | `subject`, `message`, `admin_reply`, `status` |
| `store_settings` | Key/value settings; `is_public` rows are visible to shoppers | store info, payment accounts, trending searches |

## Functions (RPC)

| Function | Who can call | What it does |
| --- | --- | --- |
| `place_order(...)` | signed-in users | Validates contact/address, re-prices every line from the DB, locks and reserves stock, applies coupon (row-locked) and delivery charge, creates order + items + payment + history + notification |
| `cancel_my_order(order, reason)` | order owner | Only while *Order Placed / Confirmed*; returns stock |
| `admin_update_order_status`, `admin_assign_rider`, `admin_set_payment_status`, `admin_set_user_role`, `admin_dashboard_stats` | admins (checked inside) | Order workflow, rider assignment, payment verification, role changes, dashboard numbers |
| `rider_update_order(order, action)` | the assigned rider | `accept` → `picked_up` → `on_the_way` → `delivered`, one step at a time; COD becomes *collected* (`awaiting_verification`) on delivery, never paid |
| `calculate_delivery(province, city, area, subtotal)` | everyone | Delivery charge + ETA used by storefront, checkout and `place_order` |
| `validate_coupon(code, subtotal)` | everyone | Coupon check and discount amount |

Triggers: create profile on sign-up; block non-admin role/email changes; keep one default
address; sync product stock from variants; set verified-purchase + author name on reviews;
refresh product rating; `updated_at` timestamps.

## Row level security (summary)

- Catalogue tables: public **read** (active rows only), admin **write**.
- `profiles`: own row (read/update), admins all.
- `addresses`, `wishlist_items`, `notifications`: own rows only (admins may read addresses).
- `orders`, `order_items`, `order_status_history`: owner, **assigned rider**, or admin can read.
  Nobody but admins may update orders directly; inserts only happen inside `place_order()`.
- `payments`: owner or admin read.
- `reviews`: approved reviews public; authors manage their own; admins moderate.
- `support_tickets`: owner creates/reads; admins reply.
- `coupons`: active public coupons readable; admins manage.
- Storage bucket `product-images`: public read, admin upload/update/delete.

## Courier, COD and seller settlement (`20261001000001_courier_settlement.sql`)

Additive only. Existing tables are not recreated; no data or policies are removed.

| Change | Why |
| --- | --- |
| `vendors.commission_type`, `vendors.commission_value` (nullable) | Per-seller commission override; empty = default |
| `settlement_settings` (1 row) | Default NEXORA commission (percent or fixed) — configurable, not hard-coded |
| `couriers` | Courier companies, default charge per shipment, tracking URL template, `code` for future API integrations |
| `shipments` | One per order per seller: courier, tracking number, shipment status, delivery date, COD amount, courier charges, other deductions, COD settlement status, amount received, courier settlement date and reference, order number snapshot |
| `seller_settlements` | Seller ledger: sales, courier deductions, commission (rate + amount), seller payable, status `pending → available → approved → paid` (or `on_hold` / `cancelled`), approval, paid amount/date, payment reference |

Functions: `admin_save_shipment`, `admin_verify_cod`, `admin_approve_settlement`,
`admin_mark_settlement_paid`, `admin_hold_settlement`, `admin_link_seller`,
`admin_recompute_open_settlements` (admins only), `seller_balance_summary` (admin or the store's
seller), `is_vendor_owner`. Amounts are calculated by `_recompute_settlement`; they lock once COD is
verified (shipment amounts) and once a settlement is approved (seller amounts).

RLS: admins read everything; a seller (`profiles.role = 'vendor'` and `vendors.owner_id = auth.uid()`)
can only **read** their own store's shipments and settlements. There are no insert/update/delete
policies on shipments or settlements — every change goes through the admin functions.

The same migration also relies on a fix in `20260930000002_functions.sql`: `place_order()` no longer
fails for orders without a coupon in a fresh database session. If you already ran that file, run it
again (it only uses `create or replace`).

## COD payment states (`20261002000001_cod_payment_states.sql`)

"Delivered" never means NEXORA has the money. Only replaces functions and adds the `NEXORA Rider`
courier row; no tables, columns, enums or policies change.

| Stage | Where it is stored |
| --- | --- |
| COD Pending | order not delivered, `orders.payment_status = pending` |
| COD Collected / Courier Settlement Pending | delivered (rider or courier holds the cash): `payment_status = awaiting_verification`, shipment `cod_settlement_status = pending` |
| Received — not verified | `cod_settlement_status = received` |
| COD Received by NEXORA | admin verified: `cod_settlement_status = verified`; when every COD shipment of the order is verified, `payment_status = paid` |
| Seller Payable → Payout Pending → Seller Paid | `seller_settlements.status` = `available` → `approved` → `paid` |

- Rider-delivered orders: record the rider handover in *Courier & COD* with the **NEXORA Rider** courier, then verify it like courier COD.
- Prepaid orders (Easypaisa / JazzCash / bank) become seller payable only when the payment is verified **and** the shipment is delivered.
- A COD verification can no longer be changed once the seller settlement is approved or paid.

## Order ↔ shipment ↔ settlement sync (`20261003000001_order_shipment_sync.sql`)

Only replaces functions and adds internal helpers; no tables, columns, enums or policies change.

- **Rider orders:** assigning a rider books one `NEXORA Rider` shipment per seller (tracking number =
  order number) and a pending seller settlement. Shipments are unique per order + seller and
  settlements unique per shipment, so reassigning never duplicates them.
- **Cancel:** admin or customer cancellation cancels the order's booked / in-transit shipments, so their
  settlements become `cancelled` (and stay cancelled on recompute). Orders with a delivered shipment
  can't be cancelled — mark the shipment Returned first. Shipments of a cancelled order can't be edited.
- **Status sync:** rider picked up / on the way → shipments In Transit; rider or admin delivered →
  open shipments Delivered. A courier shipment In Transit moves a Placed / Confirmed / Processing order
  to On The Way; when every seller's shipment is Delivered the order becomes Delivered. COD is then
  only *collected* — it becomes paid when an admin verifies it. Returned shipments never auto-cancel
  an order (cancelling restocks items, so it stays an admin decision).

## Make yourself admin

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
