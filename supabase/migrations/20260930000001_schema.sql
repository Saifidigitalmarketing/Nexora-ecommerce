-- =====================================================================
-- NEXORA — core schema
-- Everything. One Place.
--
-- Safe to run on a fresh Supabase project. Uses IF NOT EXISTS where
-- possible so it never drops or rewrites existing data.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('customer', 'admin', 'rider', 'vendor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'placed',        -- Order Placed
    'confirmed',     -- Order Confirmed
    'processing',    -- Processing
    'assigned',      -- Assigned to Rider
    'picked_up',     -- Picked Up
    'on_the_way',    -- On The Way
    'delivered',     -- Delivered
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cod', 'easypaisa', 'jazzcash', 'bank_transfer', 'card');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'awaiting_verification', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  whatsapp    text,
  avatar_url  text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------

-- Vendors = stores that sell on NEXORA. Today every store is run by
-- NEXORA admins; owner_id allows real sellers to be onboarded later.
create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  logo_url     text,
  badge        text,                      -- e.g. 'PTA Approved', '18M Warranty'
  is_official  boolean not null default false,
  is_active    boolean not null default true,
  owner_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.brands (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  logo_url     text,
  icon         text,                      -- Material Symbols name
  short_code   text,                      -- monogram fallback e.g. 'KH'
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  icon        text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories (parent_id);

create table if not exists public.products (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references public.vendors (id),
  brand_id               uuid references public.brands (id) on delete set null,
  category_id            uuid not null references public.categories (id),
  name                   text not null,
  slug                   text not null unique,
  short_description      text,
  description            text,
  price                  numeric(12,2) not null check (price >= 0),
  compare_at_price       numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  stock                  int not null default 0 check (stock >= 0),
  sku                    text,
  badges                 text[] not null default '{}',
  specs                  jsonb not null default '[]'::jsonb,  -- [{label, value, detail}]
  tags                   text[] not null default '{}',
  is_active              boolean not null default true,
  is_featured            boolean not null default false,
  is_flash_deal          boolean not null default false,
  flash_deal_ends_at     timestamptz,
  flash_deal_stock_total int,
  rating_avg             numeric(2,1) not null default 0,
  rating_count           int not null default 0,
  sold_count             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_brand_idx    on public.products (brand_id);
create index if not exists products_vendor_idx   on public.products (vendor_id);
create index if not exists products_active_idx   on public.products (is_active, created_at desc);

create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  int not null default 0
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

-- A variant is one purchasable combination, e.g.
-- options = {"Finish": "Natural Titanium", "Storage": "256 GB"}
create table if not exists public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  label             text not null,
  options           jsonb not null default '{}'::jsonb,
  color_hex         text,
  price             numeric(12,2) not null check (price >= 0),
  compare_at_price  numeric(12,2),
  stock             int not null default 0 check (stock >= 0),
  sku               text,
  sort_order        int not null default 0,
  is_active         boolean not null default true
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);

-- Home page hero / promotional banners
create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  badge       text,
  image_url   text,
  cta_label   text,
  cta_link    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Customer data
-- ---------------------------------------------------------------------
create table if not exists public.wishlist_items (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  label         text not null default 'Home',
  full_name     text not null,
  phone         text not null,
  province      text not null,
  city          text not null,
  area          text not null,
  address_line  text not null,
  landmark      text,
  postal_code   text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  order_id     uuid,
  subject      text not null,
  message      text not null,
  status       text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_reply  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code = upper(code)),
  description       text,
  discount_type     public.discount_type not null,
  value             numeric(12,2) not null check (value > 0),
  min_order_amount  numeric(12,2) not null default 0,
  max_discount      numeric(12,2),
  starts_at         timestamptz,
  ends_at           timestamptz,
  usage_limit       int,
  per_user_limit    int not null default 1,
  used_count        int not null default 0,
  is_active         boolean not null default true,
  is_public         boolean not null default true,  -- listed in "My Coupons"
  created_at        timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  order_id    uuid,
  created_at  timestamptz not null default now()
);
create index if not exists coupon_redemptions_idx on public.coupon_redemptions (coupon_id, user_id);

-- ---------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------
-- One row. mode: 'fixed' = base_charge everywhere, 'area' = zones then
-- base_charge fallback, 'distance' = reserved for per-km pricing.
create table if not exists public.delivery_settings (
  id                       int primary key default 1 check (id = 1),
  mode                     text not null default 'area' check (mode in ('fixed', 'area', 'distance')),
  base_charge              numeric(12,2) not null default 250,
  eta_min_days             int not null default 2,
  eta_max_days             int not null default 5,
  free_delivery_enabled    boolean not null default false,
  free_delivery_threshold  numeric(12,2),
  per_km_rate              numeric(12,2),   -- future: distance mode
  base_km                  numeric(6,2),    -- future: distance mode
  updated_at               timestamptz not null default now()
);

-- Most specific active match wins: area > city > province.
create table if not exists public.delivery_zones (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  province      text not null,
  city          text,
  area          text,
  charge        numeric(12,2) not null check (charge >= 0),
  eta_min_days  int not null default 1,
  eta_max_days  int not null default 3,
  priority      int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Riders
-- ---------------------------------------------------------------------
create table if not exists public.riders (
  id              uuid primary key references public.profiles (id) on delete cascade,
  vehicle_type    text not null default 'Motorbike',
  vehicle_number  text,
  cnic            text,
  zone_city       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 10001;

create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique,
  user_id                  uuid not null references public.profiles (id),
  -- customer snapshot
  customer_name            text not null,
  customer_phone           text not null,
  customer_whatsapp        text,
  customer_email           text,
  -- delivery snapshot
  province                 text not null,
  city                     text not null,
  area                     text not null,
  address_line             text not null,
  landmark                 text,
  postal_code              text,
  -- money (PKR)
  subtotal                 numeric(12,2) not null,
  discount_total           numeric(12,2) not null default 0,
  coupon_code              text,
  delivery_charge          numeric(12,2) not null default 0,
  total                    numeric(12,2) not null,
  -- payment
  payment_method           public.payment_method not null,
  payment_status           public.payment_status not null default 'pending',
  payment_reference        text,
  -- fulfilment
  status                   public.order_status not null default 'placed',
  rider_id                 uuid references public.riders (id) on delete set null,
  rider_accepted_at        timestamptz,
  estimated_delivery_from  date,
  estimated_delivery_to    date,
  notes                    text,
  cancel_reason            text,
  delivered_at             timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists orders_user_idx   on public.orders (user_id, created_at desc);
create index if not exists orders_rider_idx  on public.orders (rider_id, status);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  variant_id     uuid references public.product_variants (id) on delete set null,
  vendor_id      uuid references public.vendors (id) on delete set null,
  product_name   text not null,
  variant_label  text,
  image_url      text,
  unit_price     numeric(12,2) not null,
  quantity       int not null check (quantity > 0),
  line_total     numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  status      public.order_status not null,
  note        text,
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_history_idx on public.order_status_history (order_id, created_at);

-- One row per payment attempt. Gateways (card, wallet APIs) will write
-- here via a server webhook in the future.
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  method         public.payment_method not null,
  provider       text not null default 'manual',
  amount         numeric(12,2) not null,
  status         public.payment_status not null default 'pending',
  reference      text,
  meta           jsonb not null default '{}'::jsonb,
  verified_by    uuid references public.profiles (id) on delete set null,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  author_name           text,
  rating                int not null check (rating between 1 and 5),
  title                 text,
  body                  text,
  is_verified_purchase  boolean not null default false,
  is_approved           boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

-- ---------------------------------------------------------------------
-- Store settings (key/value). is_public rows are readable by shoppers,
-- e.g. wallet account numbers shown at checkout.
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now()
);
