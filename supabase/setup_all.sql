-- NEXORA: full database setup in one file (generated from supabase/migrations + seed.sql)
-- Paste into the Supabase SQL Editor and click Run. Safe to run again.

-- ===================== supabase/migrations/20260930000001_schema.sql =====================
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

-- ===================== supabase/migrations/20260930000002_functions.sql =====================
-- =====================================================================
-- NEXORA — functions, triggers and RPCs
--
-- Every privileged write (placing an order, changing its status,
-- assigning riders) goes through a SECURITY DEFINER function that
-- re-checks auth.uid() and the caller's role. Prices, coupons and
-- delivery charges are always computed here, never trusted from the
-- browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_rider()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p join public.riders r on r.id = p.id
    where p.id = auth.uid() and p.role = 'rider' and r.is_active
  )
$$;

-- ---------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
drop trigger if exists support_touch on public.support_tickets;
create trigger support_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

-- New auth user -> profile row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change a role. Blocks privilege escalation through
-- "update my profile".
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null           -- allow SQL editor / service role
     and not public.is_admin() then
    raise exception 'Only admins can change user roles' using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Profile id is immutable' using errcode = '42501';
  end if;
  -- email mirrors auth.users and is used by admins to find accounts
  if new.email is distinct from old.email and auth.uid() is not null and not public.is_admin() then
    raise exception 'Email can only be changed by support' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Only one default address per user
create or replace function public.single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;

drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default after insert or update of is_default on public.addresses
  for each row when (new.is_default) execute function public.single_default_address();

-- Products that have variants show the sum of active variant stock.
create or replace function public.sync_product_stock_from_variants()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set stock = coalesce(
    (select sum(stock) from public.product_variants where product_id = pid and is_active), 0)
  where p.id = pid
    and exists (select 1 from public.product_variants where product_id = pid);
  return null;
end $$;

drop trigger if exists variants_sync_stock on public.product_variants;
create trigger variants_sync_stock after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock_from_variants();

-- ---------------------------------------------------------------------
-- Reviews: verified-purchase flag + product rating aggregates
-- ---------------------------------------------------------------------
create or replace function public.reviews_before_write()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_verified_purchase := exists (
      select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
      where o.user_id = new.user_id and oi.product_id = new.product_id and o.status = 'delivered'
    );
    if not public.is_admin() or new.author_name is null or new.author_name = '' then
      select coalesce(nullif(full_name, ''), 'NEXORA Customer') into new.author_name from public.profiles where id = new.user_id;
    end if;
    if not public.is_admin() then
      new.is_approved := true;
    end if;
  elsif not public.is_admin() then
    -- customers may edit text/rating but not moderation fields
    new.is_verified_purchase := old.is_verified_purchase;
    new.is_approved := old.is_approved;
    new.user_id := old.user_id;
    new.product_id := old.product_id;
    new.author_name := old.author_name;
  end if;
  return new;
end $$;

drop trigger if exists reviews_before_write on public.reviews;
create trigger reviews_before_write before insert or update on public.reviews
  for each row execute function public.reviews_before_write();

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where product_id = pid and is_approved), 0),
    rating_count = (select count(*) from public.reviews where product_id = pid and is_approved)
  where p.id = pid;
  return null;
end $$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------
-- Delivery charge engine
--   fixed    -> base_charge
--   area     -> most specific active zone, else base_charge
--   distance -> reserved; falls back to area rules until implemented
-- Free delivery applies on top when enabled and threshold is met.
-- ---------------------------------------------------------------------
create or replace function public.calculate_delivery(
  p_province text, p_city text, p_area text, p_subtotal numeric
)
returns table (charge numeric, eta_min_days int, eta_max_days int, zone_name text, is_free boolean, free_threshold numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  s public.delivery_settings;
  z public.delivery_zones;
begin
  select * into s from public.delivery_settings where id = 1;
  if not found then
    s.mode := 'fixed'; s.base_charge := 250; s.eta_min_days := 2; s.eta_max_days := 5;
    s.free_delivery_enabled := false;
  end if;

  if s.mode in ('area', 'distance') then
    select * into z from public.delivery_zones dz
    where dz.is_active
      and lower(dz.province) = lower(trim(coalesce(p_province, '')))
      and (dz.city is null or lower(dz.city) = lower(trim(coalesce(p_city, ''))))
      and (dz.area is null or lower(dz.area) = lower(trim(coalesce(p_area, ''))))
    order by (dz.area is not null) desc, (dz.city is not null) desc, dz.priority desc
    limit 1;
  end if;

  charge       := coalesce(z.charge, s.base_charge);
  eta_min_days := coalesce(z.eta_min_days, s.eta_min_days);
  eta_max_days := coalesce(z.eta_max_days, s.eta_max_days);
  zone_name    := coalesce(z.name, 'Standard');
  free_threshold := case when s.free_delivery_enabled then s.free_delivery_threshold end;
  is_free := s.free_delivery_enabled and s.free_delivery_threshold is not null
             and coalesce(p_subtotal, 0) >= s.free_delivery_threshold;
  if is_free then charge := 0; end if;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (valid boolean, code text, discount numeric, message text)
language plpgsql stable security definer set search_path = public
as $$
declare
  c public.coupons;
  used_by_me int;
  d numeric;
begin
  code := upper(trim(coalesce(p_code, '')));
  valid := false; discount := 0;
  if code = '' then message := 'Enter a coupon code'; return next; return; end if;

  select * into c from public.coupons where coupons.code = validate_coupon.code;
  if not found or not c.is_active then message := 'This coupon is not valid'; return next; return; end if;
  if c.starts_at is not null and now() < c.starts_at then message := 'This coupon is not active yet'; return next; return; end if;
  if c.ends_at is not null and now() > c.ends_at then message := 'This coupon has expired'; return next; return; end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then message := 'This coupon has been fully redeemed'; return next; return; end if;
  if coalesce(p_subtotal, 0) < c.min_order_amount then
    message := 'Minimum order of Rs. ' || to_char(c.min_order_amount, 'FM999,999,990') || ' required';
    return next; return;
  end if;
  if auth.uid() is not null then
    select count(*) into used_by_me from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = auth.uid();
    if used_by_me >= c.per_user_limit then message := 'You have already used this coupon'; return next; return; end if;
  end if;

  if c.discount_type = 'percent' then
    d := round(p_subtotal * c.value / 100);
    if c.max_discount is not null then d := least(d, c.max_discount); end if;
  else
    d := least(c.value, p_subtotal);
  end if;

  valid := true; discount := d; message := coalesce(c.description, 'Coupon applied');
  return next;
end $$;

-- ---------------------------------------------------------------------
-- Notifications helper (internal)
-- ---------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link) values (p_user, p_title, p_body, p_link);
$$;
revoke execute on function public.notify_user(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.order_status_label(s public.order_status)
returns text language sql immutable as $$
  select case s
    when 'placed' then 'Order Placed'
    when 'confirmed' then 'Order Confirmed'
    when 'processing' then 'Processing'
    when 'assigned' then 'Assigned to Rider'
    when 'picked_up' then 'Picked Up'
    when 'on_the_way' then 'On The Way'
    when 'delivered' then 'Delivered'
    when 'cancelled' then 'Cancelled'
  end
$$;

-- Internal: apply a status change, write history, notify the customer.
create or replace function public._set_order_status(p_order uuid, p_status public.order_status, p_note text)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  update public.orders set
    status       = p_status,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = p_order
  returning * into o;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order, p_status, p_note, auth.uid());

  perform public.notify_user(
    o.user_id,
    'Order ' || o.order_number || ': ' || public.order_status_label(p_status),
    coalesce(p_note, 'Your order status has been updated.'),
    '/account/orders/' || o.order_number
  );
  return o;
end $$;
revoke execute on function public._set_order_status(uuid, public.order_status, text) from public, anon, authenticated;

-- Internal: return stock for a cancelled order
create or replace function public._restock_order(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  it record;
begin
  for it in select * from public.order_items where order_id = p_order loop
    if it.variant_id is not null then
      update public.product_variants set stock = stock + it.quantity where id = it.variant_id;
    end if;
    if it.product_id is not null then
      update public.products set
        stock = case when it.variant_id is null then stock + it.quantity else stock end,
        sold_count = greatest(sold_count - it.quantity, 0)
      where id = it.product_id;
    end if;
  end loop;
end $$;
revoke execute on function public._restock_order(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- place_order
-- p_items    : [{"product_id": uuid, "variant_id": uuid|null, "quantity": int}]
-- p_customer : {"full_name","phone","whatsapp","email"}
-- p_address  : {"province","city","area","address_line","landmark","postal_code"}
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_items             jsonb,
  p_customer          jsonb,
  p_address           jsonb,
  p_payment_method    public.payment_method,
  p_payment_reference text default null,
  p_coupon_code       text default null,
  p_notes             text default null,
  p_save_address      boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it jsonb;
  prod public.products;
  var public.product_variants;
  qty int;
  unit numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_coupon record;
  v_coupon_code text;  -- set only when a coupon applies (record may be unassigned)
  v_delivery record;
  v_total numeric;
  v_order public.orders;
  v_number text;
  v_img text;
  v_pay_status public.payment_status := 'pending';
  line_items jsonb := '[]'::jsonb;
  li jsonb;
  phone_re constant text := '^(\+92|0092|0)?3[0-9]{2}[- ]?[0-9]{7}$';
begin
  if uid is null then
    raise exception 'Please sign in to place an order' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order' using errcode = '22023';
  end if;

  -- customer + address validation
  if length(trim(coalesce(p_customer ->> 'full_name', ''))) < 2 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;
  if coalesce(p_customer ->> 'phone', '') !~ phone_re then
    raise exception 'Enter a valid Pakistani mobile number' using errcode = '22023';
  end if;
  if coalesce(p_customer ->> 'whatsapp', '') <> '' and (p_customer ->> 'whatsapp') !~ phone_re then
    raise exception 'Enter a valid WhatsApp number' using errcode = '22023';
  end if;
  if coalesce(p_customer ->> 'email', '') <> '' and (p_customer ->> 'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_address ->> 'province', ''))) = 0
     or length(trim(coalesce(p_address ->> 'city', ''))) = 0
     or length(trim(coalesce(p_address ->> 'area', ''))) = 0
     or length(trim(coalesce(p_address ->> 'address_line', ''))) < 5 then
    raise exception 'Complete delivery address is required' using errcode = '22023';
  end if;

  if p_payment_method = 'card' then
    raise exception 'Card payments are coming soon. Please choose another method.' using errcode = '22023';
  end if;
  if p_payment_method in ('easypaisa', 'jazzcash', 'bank_transfer') then
    v_pay_status := case when coalesce(trim(p_payment_reference), '') <> '' then 'awaiting_verification' else 'pending' end;
  end if;

  -- price every line from the database and reserve stock
  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it ->> 'quantity')::int, 0);
    if qty < 1 or qty > 20 then
      raise exception 'Invalid quantity' using errcode = '22023';
    end if;

    select * into prod from public.products where id = (it ->> 'product_id')::uuid and is_active for update;
    if not found then
      raise exception 'A product in your cart is no longer available' using errcode = 'P0002';
    end if;

    var := null;
    if nullif(it ->> 'variant_id', '') is not null then
      select * into var from public.product_variants
      where id = (it ->> 'variant_id')::uuid and product_id = prod.id and is_active for update;
      if not found then
        raise exception '% option is no longer available', prod.name using errcode = 'P0002';
      end if;
      if var.stock < qty then
        raise exception 'Only % left of % (%)', var.stock, prod.name, var.label using errcode = 'P0001';
      end if;
      unit := var.price;
      update public.product_variants set stock = stock - qty where id = var.id;
      update public.products set sold_count = sold_count + qty where id = prod.id;
    else
      if exists (select 1 from public.product_variants where product_id = prod.id and is_active) then
        raise exception 'Please choose an option for %', prod.name using errcode = '22023';
      end if;
      if prod.stock < qty then
        raise exception 'Only % left of %', prod.stock, prod.name using errcode = 'P0001';
      end if;
      unit := prod.price;
      update public.products set stock = stock - qty, sold_count = sold_count + qty where id = prod.id;
    end if;

    select url into v_img from public.product_images where product_id = prod.id order by sort_order limit 1;

    v_subtotal := v_subtotal + unit * qty;
    line_items := line_items || jsonb_build_object(
      'product_id', prod.id, 'variant_id', var.id, 'vendor_id', prod.vendor_id,
      'product_name', prod.name, 'variant_label', var.label, 'image_url', v_img,
      'unit_price', unit, 'quantity', qty, 'line_total', unit * qty
    );
  end loop;

  -- coupon
  if coalesce(trim(p_coupon_code), '') <> '' then
    -- serialise concurrent redemptions of the same code
    perform 1 from public.coupons where code = upper(trim(p_coupon_code)) for update;
    select * into v_coupon from public.validate_coupon(p_coupon_code, v_subtotal);
    if not v_coupon.valid then
      raise exception '%', v_coupon.message using errcode = '22023';
    end if;
    v_discount := v_coupon.discount;
    v_coupon_code := v_coupon.code;
  end if;

  -- delivery (on subtotal after discount)
  select * into v_delivery from public.calculate_delivery(
    p_address ->> 'province', p_address ->> 'city', p_address ->> 'area', v_subtotal - v_discount);

  v_total := greatest(v_subtotal - v_discount, 0) + v_delivery.charge;
  v_number := 'NX-' || to_char(now() at time zone 'Asia/Karachi', 'YYMMDD') || '-' || nextval('public.order_number_seq');

  insert into public.orders (
    order_number, user_id,
    customer_name, customer_phone, customer_whatsapp, customer_email,
    province, city, area, address_line, landmark, postal_code,
    subtotal, discount_total, coupon_code, delivery_charge, total,
    payment_method, payment_status, payment_reference,
    estimated_delivery_from, estimated_delivery_to, notes
  ) values (
    v_number, uid,
    trim(p_customer ->> 'full_name'), trim(p_customer ->> 'phone'),
    nullif(trim(p_customer ->> 'whatsapp'), ''), nullif(trim(p_customer ->> 'email'), ''),
    trim(p_address ->> 'province'), trim(p_address ->> 'city'), trim(p_address ->> 'area'),
    trim(p_address ->> 'address_line'), nullif(trim(p_address ->> 'landmark'), ''),
    nullif(trim(p_address ->> 'postal_code'), ''),
    v_subtotal, v_discount, case when v_discount > 0 then v_coupon_code end, v_delivery.charge, v_total,
    p_payment_method, v_pay_status, nullif(trim(p_payment_reference), ''),
    current_date + v_delivery.eta_min_days, current_date + v_delivery.eta_max_days,
    nullif(trim(p_notes), '')
  ) returning * into v_order;

  for li in select * from jsonb_array_elements(line_items) loop
    insert into public.order_items (order_id, product_id, variant_id, vendor_id, product_name, variant_label,
                                    image_url, unit_price, quantity, line_total)
    values (v_order.id, (li ->> 'product_id')::uuid, nullif(li ->> 'variant_id', '')::uuid,
            (li ->> 'vendor_id')::uuid, li ->> 'product_name', li ->> 'variant_label', li ->> 'image_url',
            (li ->> 'unit_price')::numeric, (li ->> 'quantity')::int, (li ->> 'line_total')::numeric);
  end loop;

  insert into public.payments (order_id, method, amount, status, reference)
  values (v_order.id, p_payment_method, v_total, v_pay_status, nullif(trim(p_payment_reference), ''));

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_order.id, 'placed', 'Order placed by customer', uid);

  if v_discount > 0 then
    update public.coupons set used_count = used_count + 1 where code = v_coupon_code;
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    select id, uid, v_order.id from public.coupons where code = v_coupon_code;
  end if;

  -- keep contact details on the profile for next time
  update public.profiles set
    full_name = coalesce(nullif(full_name, ''), trim(p_customer ->> 'full_name')),
    phone     = coalesce(nullif(phone, ''), trim(p_customer ->> 'phone')),
    whatsapp  = coalesce(nullif(whatsapp, ''), nullif(trim(p_customer ->> 'whatsapp'), ''))
  where id = uid;

  if p_save_address then
    insert into public.addresses (user_id, full_name, phone, province, city, area, address_line, landmark, postal_code, is_default)
    values (uid, trim(p_customer ->> 'full_name'), trim(p_customer ->> 'phone'),
            trim(p_address ->> 'province'), trim(p_address ->> 'city'), trim(p_address ->> 'area'),
            trim(p_address ->> 'address_line'), nullif(trim(p_address ->> 'landmark'), ''),
            nullif(trim(p_address ->> 'postal_code'), ''),
            not exists (select 1 from public.addresses where user_id = uid));
  end if;

  perform public.notify_user(uid, 'Order ' || v_number || ' placed',
    'Thank you for shopping with NEXORA. We will confirm your order shortly.',
    '/account/orders/' || v_number);

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_number, 'total', v_total);
end $$;

-- ---------------------------------------------------------------------
-- Customer: cancel own order before it is processed
-- ---------------------------------------------------------------------
create or replace function public.cancel_my_order(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status not in ('placed', 'confirmed') then
    raise exception 'This order can no longer be cancelled' using errcode = 'P0001';
  end if;
  update public.orders set cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer') where id = o.id;
  perform public._restock_order(o.id);
  update public.payments set status = case when status = 'paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
  where order_id = o.id;
  update public.orders set payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
  where id = o.id;
  perform public._set_order_status(o.id, 'cancelled', 'Cancelled by customer');
end $$;

-- ---------------------------------------------------------------------
-- Admin: status changes, rider assignment, payment verification
-- ---------------------------------------------------------------------
create or replace function public.admin_update_order_status(p_order uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status in ('delivered', 'cancelled') then
    raise exception 'Order is already %', public.order_status_label(o.status) using errcode = 'P0001';
  end if;
  if p_status = o.status then return; end if;
  if p_status = 'assigned' and o.rider_id is null then
    raise exception 'Assign a rider first' using errcode = 'P0001';
  end if;
  if p_status = 'cancelled' then
    perform public._restock_order(o.id);
    update public.orders set cancel_reason = coalesce(nullif(trim(p_note), ''), 'Cancelled by NEXORA') where id = o.id;
  end if;
  if p_status = 'delivered' and o.payment_method = 'cod' then
    update public.orders set payment_status = 'paid' where id = o.id;
    update public.payments set status = 'paid', verified_by = auth.uid(), verified_at = now() where order_id = o.id;
  end if;
  perform public._set_order_status(o.id, p_status, p_note);
end $$;

create or replace function public.admin_assign_rider(p_order uuid, p_rider uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if not exists (select 1 from public.riders r join public.profiles p on p.id = r.id
                 where r.id = p_rider and r.is_active and p.role = 'rider') then
    raise exception 'Rider not found or inactive' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status in ('picked_up', 'on_the_way', 'delivered', 'cancelled') then
    raise exception 'Rider can no longer be changed for this order' using errcode = 'P0001';
  end if;
  update public.orders set rider_id = p_rider, rider_accepted_at = null where id = o.id;
  perform public._set_order_status(o.id, 'assigned', 'A rider has been assigned to your order');
  perform public.notify_user(p_rider, 'New delivery assigned', 'Order ' || o.order_number || ' — ' || o.area || ', ' || o.city, '/rider');
end $$;

create or replace function public.admin_set_payment_status(p_order uuid, p_status public.payment_status, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  update public.orders set payment_status = p_status where id = p_order;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  update public.payments set status = p_status, verified_by = auth.uid(), verified_at = now(),
    meta = meta || jsonb_build_object('note', p_note)
  where order_id = p_order;
end $$;

-- Admin: make a user a rider (or revoke)
create or replace function public.admin_set_user_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin access' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if p_role = 'rider' then
    insert into public.riders (id) values (p_user) on conflict (id) do update set is_active = true;
  else
    update public.riders set is_active = false where id = p_user;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Rider workflow. A rider can only touch orders assigned to them, and
-- only move them forward one step at a time.
--   accept      : assigned  (not yet accepted) -> assigned (accepted)
--   picked_up   : assigned  (accepted)         -> picked_up
--   on_the_way  : picked_up                    -> on_the_way
--   delivered   : on_the_way                   -> delivered
-- ---------------------------------------------------------------------
create or replace function public.rider_update_order(p_order uuid, p_action text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_rider() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order and rider_id = auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'accept' then
    if o.status <> 'assigned' or o.rider_accepted_at is not null then
      raise exception 'Order cannot be accepted now' using errcode = 'P0001';
    end if;
    update public.orders set rider_accepted_at = now() where id = o.id;
    insert into public.order_status_history (order_id, status, note, changed_by)
    values (o.id, 'assigned', 'Rider accepted the delivery', auth.uid());
  elsif p_action = 'picked_up' then
    if o.status <> 'assigned' or o.rider_accepted_at is null then
      raise exception 'Accept the order before pickup' using errcode = 'P0001';
    end if;
    perform public._set_order_status(o.id, 'picked_up', 'Your order has been picked up by the rider');
  elsif p_action = 'on_the_way' then
    if o.status <> 'picked_up' then raise exception 'Mark the order as picked up first' using errcode = 'P0001'; end if;
    perform public._set_order_status(o.id, 'on_the_way', 'Your rider is on the way');
  elsif p_action = 'delivered' then
    if o.status <> 'on_the_way' then raise exception 'Order must be on the way first' using errcode = 'P0001'; end if;
    if o.payment_method = 'cod' then
      update public.orders set payment_status = 'paid' where id = o.id;
      update public.payments set status = 'paid', verified_by = auth.uid(), verified_at = now(),
        meta = meta || '{"collected_by": "rider"}'::jsonb
      where order_id = o.id;
    end if;
    perform public._set_order_status(o.id, 'delivered', 'Delivered. Thank you for shopping with NEXORA!');
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin dashboard numbers
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select jsonb_build_object(
    'revenue_total',   coalesce((select sum(total) from public.orders where status <> 'cancelled'), 0),
    'revenue_today',   coalesce((select sum(total) from public.orders where status <> 'cancelled'
                                  and created_at >= date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi'), 0),
    'orders_total',    (select count(*) from public.orders),
    'orders_pending',  (select count(*) from public.orders where status in ('placed', 'confirmed', 'processing')),
    'orders_in_transit', (select count(*) from public.orders where status in ('assigned', 'picked_up', 'on_the_way')),
    'orders_delivered',  (select count(*) from public.orders where status = 'delivered'),
    'payments_to_verify', (select count(*) from public.orders where payment_status = 'awaiting_verification'),
    'customers_total', (select count(*) from public.profiles where role = 'customer'),
    'products_total',  (select count(*) from public.products),
    'low_stock',       (select count(*) from public.products p
                         where p.is_active and (
                           (not exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active) and p.stock <= 5)
                           or exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active and v.stock <= 5))),
    'sales_last_14_days', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'total', coalesce(t.total, 0), 'orders', coalesce(t.cnt, 0)) order by d)
        from generate_series((now() at time zone 'Asia/Karachi')::date - 13, (now() at time zone 'Asia/Karachi')::date, interval '1 day') d
        left join (
          select (created_at at time zone 'Asia/Karachi')::date as day, sum(total) as total, count(*) as cnt
          from public.orders where status <> 'cancelled' group by 1
        ) t on t.day = d::date
      ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- Execute grants: callable by signed-in users only. Each function checks
-- the caller's role internally as well.
-- ---------------------------------------------------------------------
revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text, boolean) from public, anon;
revoke execute on function public.cancel_my_order(uuid, text) from public, anon;
revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.admin_assign_rider(uuid, uuid) from public, anon;
revoke execute on function public.admin_set_payment_status(uuid, public.payment_status, text) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, public.user_role) from public, anon;
revoke execute on function public.rider_update_order(uuid, text) from public, anon;
revoke execute on function public.admin_dashboard_stats() from public, anon;

grant execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text, boolean) to authenticated;
grant execute on function public.cancel_my_order(uuid, text) to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_assign_rider(uuid, uuid) to authenticated;
grant execute on function public.admin_set_payment_status(uuid, public.payment_status, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.rider_update_order(uuid, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.calculate_delivery(text, text, text, numeric) to anon, authenticated;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- ===================== supabase/migrations/20260930000003_rls.sql =====================
-- =====================================================================
-- NEXORA — row level security
--
-- Customers : only their own profile, addresses, wishlist, orders,
--             notifications and tickets.
-- Riders    : only orders where orders.rider_id = auth.uid().
-- Admins    : everything (profiles.role = 'admin').
-- Public    : read-only catalogue.
-- Orders are never inserted/updated directly by customers or riders;
-- that happens through SECURITY DEFINER functions.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.vendors               enable row level security;
alter table public.brands                enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_variants      enable row level security;
alter table public.banners               enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.addresses             enable row level security;
alter table public.notifications         enable row level security;
alter table public.support_tickets       enable row level security;
alter table public.coupons               enable row level security;
alter table public.coupon_redemptions    enable row level security;
alter table public.delivery_settings     enable row level security;
alter table public.delivery_zones        enable row level security;
alter table public.riders                enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payments              enable row level security;
alter table public.reviews               enable row level security;
alter table public.store_settings        enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Public catalogue (read) — admin write
-- ---------------------------------------------------------------------
drop policy if exists vendors_read on public.vendors;
create policy vendors_read on public.vendors for select using (is_active or public.is_admin());
drop policy if exists vendors_admin on public.vendors;
create policy vendors_admin on public.vendors for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands for select using (true);
drop policy if exists brands_admin on public.brands;
create policy brands_admin on public.brands for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (is_active or public.is_admin());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (is_active or public.is_admin());
drop policy if exists products_admin on public.products;
create policy products_admin on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_images_read on public.product_images;
create policy product_images_read on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
drop policy if exists product_images_admin on public.product_images;
create policy product_images_admin on public.product_images for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_variants_read on public.product_variants;
create policy product_variants_read on public.product_variants for select using (
  (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)) or public.is_admin());
drop policy if exists product_variants_admin on public.product_variants;
create policy product_variants_admin on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists banners_read on public.banners;
create policy banners_read on public.banners for select using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin());
drop policy if exists banners_admin on public.banners;
create policy banners_admin on public.banners for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists delivery_settings_read on public.delivery_settings;
create policy delivery_settings_read on public.delivery_settings for select using (true);
drop policy if exists delivery_settings_admin on public.delivery_settings;
create policy delivery_settings_admin on public.delivery_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists delivery_zones_read on public.delivery_zones;
create policy delivery_zones_read on public.delivery_zones for select using (is_active or public.is_admin());
drop policy if exists delivery_zones_admin on public.delivery_zones;
create policy delivery_zones_admin on public.delivery_zones for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings for select using (is_public or public.is_admin());
drop policy if exists store_settings_admin on public.store_settings;
create policy store_settings_admin on public.store_settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Coupons: public list of active promotional codes; admin manages.
-- ---------------------------------------------------------------------
drop policy if exists coupons_read on public.coupons;
create policy coupons_read on public.coupons for select using (
  (is_active and is_public and (ends_at is null or ends_at > now())) or public.is_admin());
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists coupon_redemptions_read on public.coupon_redemptions;
create policy coupon_redemptions_read on public.coupon_redemptions for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Customer-owned rows
-- ---------------------------------------------------------------------
drop policy if exists wishlist_own on public.wishlist_items;
create policy wishlist_own on public.wishlist_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists addresses_admin_read on public.addresses;
create policy addresses_admin_read on public.addresses for select using (public.is_admin());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete using (user_id = auth.uid());
drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_select on public.support_tickets;
create policy support_select on public.support_tickets for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists support_insert_own on public.support_tickets;
create policy support_insert_own on public.support_tickets for insert
  with check (user_id = auth.uid() and status = 'open' and admin_reply is null);
drop policy if exists support_admin on public.support_tickets;
create policy support_admin on public.support_tickets for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Riders
-- ---------------------------------------------------------------------
drop policy if exists riders_select on public.riders;
create policy riders_select on public.riders for select using (id = auth.uid() or public.is_admin());
drop policy if exists riders_admin on public.riders;
create policy riders_admin on public.riders for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Orders — read only for owners & assigned rider. Writes via RPC.
-- ---------------------------------------------------------------------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (
  user_id = auth.uid()
  or (rider_id = auth.uid() and public.is_rider())
  or public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.user_id = auth.uid() or (o.rider_id = auth.uid() and public.is_rider()) or public.is_admin())));

drop policy if exists order_history_select on public.order_status_history;
create policy order_history_select on public.order_status_history for select using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.user_id = auth.uid() or (o.rider_id = auth.uid() and public.is_rider()) or public.is_admin())));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- ---------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (is_approved or user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert with check (user_id = auth.uid());
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Table privileges. Supabase grants these by default; restated so the
-- intent is explicit. RLS above still filters every row.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on
  public.vendors, public.brands, public.categories, public.products, public.product_images,
  public.product_variants, public.banners, public.delivery_settings, public.delivery_zones,
  public.store_settings, public.coupons, public.reviews
to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Orders & payments are never written directly by non-admin clients
-- (RLS blocks it too); sequence is only used by place_order().
revoke insert, delete on public.orders, public.order_items, public.order_status_history, public.payments from authenticated;
revoke insert, delete on public.coupon_redemptions from authenticated;

-- ===================== supabase/migrations/20260930000004_storage.sql =====================
-- =====================================================================
-- NEXORA — Storage bucket for product / banner / brand images.
-- Public read, admin-only write.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product images admin insert" on storage.objects;
create policy "product images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ===================== supabase/migrations/20261001000001_courier_settlement.sql =====================
-- =====================================================================
-- NEXORA — Courier, COD settlement and seller settlement
--
-- Flow: customer pays COD to the courier → courier remits to NEXORA →
-- admin verifies the received COD → NEXORA commission and courier
-- deductions are taken → seller payable is credited → admin approves
-- and pays the seller. Sellers never receive COD directly and can only
-- READ their own figures.
--
-- Additive only: adds two nullable columns to vendors and new tables /
-- functions / policies. Nothing existing is dropped or rewritten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.shipment_status as enum ('booked', 'in_transit', 'delivered', 'returned', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cod_settlement_status as enum ('pending', 'received', 'verified', 'disputed', 'not_applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seller_settlement_status as enum ('pending', 'available', 'approved', 'paid', 'on_hold', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Commission configuration
-- ---------------------------------------------------------------------
-- Per-seller override (null = use the default in settlement_settings)
alter table public.vendors add column if not exists commission_type public.discount_type;
alter table public.vendors add column if not exists commission_value numeric(12,2)
  check (commission_value is null or commission_value >= 0);

create table if not exists public.settlement_settings (
  id                         int primary key default 1 check (id = 1),
  default_commission_type    public.discount_type not null default 'percent',
  default_commission_value   numeric(12,2) not null default 0 check (default_commission_value >= 0),
  updated_at                 timestamptz not null default now()
);
insert into public.settlement_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Couriers (TCS, Leopards, M&P, Trax, …). `code` identifies a future
-- API integration; credentials are NOT stored here (use server env).
-- ---------------------------------------------------------------------
create table if not exists public.couriers (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  code                    text not null unique check (code ~ '^[a-z0-9_]{2,30}$'),
  default_charge          numeric(12,2) not null default 0 check (default_charge >= 0),
  tracking_url_template   text,            -- e.g. https://courier.example/track?cn={tracking}
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Shipments: one per order per seller
-- ---------------------------------------------------------------------
create table if not exists public.shipments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id) on delete cascade,
  vendor_id                 uuid not null references public.vendors (id),
  courier_id                uuid references public.couriers (id) on delete set null,
  tracking_number           text,
  status                    public.shipment_status not null default 'booked',
  cod_amount                numeric(12,2) not null default 0 check (cod_amount >= 0),
  courier_charges           numeric(12,2) not null default 0 check (courier_charges >= 0),
  other_deductions          numeric(12,2) not null default 0 check (other_deductions >= 0),
  booked_at                 timestamptz not null default now(),
  delivered_at              timestamptz,
  cod_settlement_status     public.cod_settlement_status not null default 'pending',
  cod_received_amount       numeric(12,2),
  cod_settlement_date       date,
  cod_settlement_reference  text,
  cod_verified_by           uuid references public.profiles (id) on delete set null,
  cod_verified_at           timestamptz,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (order_id, vendor_id)
);
-- order number snapshot so sellers can see it without reading orders (RLS)
alter table public.shipments add column if not exists order_number text;
create index if not exists shipments_vendor_idx on public.shipments (vendor_id, created_at desc);
create index if not exists shipments_cod_idx on public.shipments (cod_settlement_status);

-- ---------------------------------------------------------------------
-- Seller settlements (ledger): one per shipment
-- ---------------------------------------------------------------------
create table if not exists public.seller_settlements (
  id                   uuid primary key default gen_random_uuid(),
  shipment_id          uuid not null unique references public.shipments (id) on delete cascade,
  order_id             uuid not null references public.orders (id) on delete cascade,
  vendor_id            uuid not null references public.vendors (id),
  gross_sales          numeric(12,2) not null,
  courier_deductions   numeric(12,2) not null default 0,
  commission_type      public.discount_type not null,
  commission_rate      numeric(12,2) not null,
  commission_amount    numeric(12,2) not null,
  seller_payable       numeric(12,2) not null,
  status               public.seller_settlement_status not null default 'pending',
  approved_by          uuid references public.profiles (id) on delete set null,
  approved_at          timestamptz,
  paid_amount          numeric(12,2),
  paid_by              uuid references public.profiles (id) on delete set null,
  paid_at              timestamptz,
  payment_reference    text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists seller_settlements_vendor_idx on public.seller_settlements (vendor_id, status);

drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();
drop trigger if exists seller_settlements_touch on public.seller_settlements;
create trigger seller_settlements_touch before update on public.seller_settlements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_vendor_owner(p_vendor uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.vendors v join public.profiles p on p.id = v.owner_id
    where v.id = p_vendor and v.owner_id = auth.uid() and p.role = 'vendor'
  )
$$;

-- Internal: (re)compute the settlement for a shipment from current config.
-- Amounts are frozen once the settlement is approved or paid.
create or replace function public._recompute_settlement(p_shipment uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  s public.shipments;
  v public.vendors;
  cfg public.settlement_settings;
  gross numeric;
  ctype public.discount_type;
  cval numeric;
  comm numeric;
  ded numeric;
  existing public.seller_settlements;
  next_status public.seller_settlement_status;
begin
  select * into s from public.shipments where id = p_shipment;
  select * into v from public.vendors where id = s.vendor_id;
  select * into cfg from public.settlement_settings where id = 1;
  select * into existing from public.seller_settlements where shipment_id = s.id;

  if found and existing.status in ('approved', 'paid') then
    return;
  end if;

  select coalesce(sum(line_total), 0) into gross
  from public.order_items where order_id = s.order_id and vendor_id = s.vendor_id;

  ctype := coalesce(v.commission_type, cfg.default_commission_type, 'percent');
  cval  := coalesce(v.commission_value, cfg.default_commission_value, 0);
  comm  := case when ctype = 'percent' then round(gross * cval / 100, 2) else least(cval, gross) end;
  ded   := s.courier_charges + s.other_deductions;

  next_status := case
    when s.status in ('returned', 'cancelled') then 'cancelled'::public.seller_settlement_status
    when s.cod_settlement_status in ('verified', 'not_applicable') then 'available'::public.seller_settlement_status
    when existing.status = 'on_hold' then 'on_hold'::public.seller_settlement_status
    else 'pending'::public.seller_settlement_status
  end;

  insert into public.seller_settlements (shipment_id, order_id, vendor_id, gross_sales, courier_deductions,
    commission_type, commission_rate, commission_amount, seller_payable, status)
  values (s.id, s.order_id, s.vendor_id, gross, ded, ctype, cval, comm, greatest(gross - ded - comm, 0), next_status)
  on conflict (shipment_id) do update set
    gross_sales = excluded.gross_sales,
    courier_deductions = excluded.courier_deductions,
    commission_type = excluded.commission_type,
    commission_rate = excluded.commission_rate,
    commission_amount = excluded.commission_amount,
    seller_payable = excluded.seller_payable,
    status = excluded.status;
end $$;
revoke execute on function public._recompute_settlement(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------

-- Create or update the courier shipment for one seller's part of an order.
create or replace function public.admin_save_shipment(
  p_order uuid,
  p_vendor uuid,
  p_courier uuid,
  p_tracking text,
  p_status public.shipment_status,
  p_cod_amount numeric,
  p_courier_charges numeric,
  p_other_deductions numeric,
  p_delivered_at timestamptz default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
  sid uuid;
  cur public.shipments;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.order_items where order_id = p_order and vendor_id = p_vendor) then
    raise exception 'This seller has no items in the order' using errcode = '22023';
  end if;
  if coalesce(p_cod_amount, 0) < 0 or coalesce(p_courier_charges, 0) < 0 or coalesce(p_other_deductions, 0) < 0 then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;

  select * into cur from public.shipments where order_id = p_order and vendor_id = p_vendor;
  if found and cur.cod_settlement_status = 'verified'
     and (p_cod_amount is distinct from cur.cod_amount
          or p_courier_charges is distinct from cur.courier_charges
          or p_other_deductions is distinct from cur.other_deductions) then
    raise exception 'COD is already verified — amounts are locked' using errcode = 'P0001';
  end if;

  insert into public.shipments (order_id, order_number, vendor_id, courier_id, tracking_number, status, cod_amount,
    courier_charges, other_deductions, delivered_at, notes, cod_settlement_status)
  values (p_order, o.order_number, p_vendor, p_courier, nullif(trim(p_tracking), ''), p_status, coalesce(p_cod_amount, 0),
    coalesce(p_courier_charges, 0), coalesce(p_other_deductions, 0),
    case when p_status = 'delivered' then coalesce(p_delivered_at, now()) else p_delivered_at end,
    nullif(trim(p_notes), ''),
    case when o.payment_method = 'cod' then 'pending'::public.cod_settlement_status else 'not_applicable'::public.cod_settlement_status end)
  on conflict (order_id, vendor_id) do update set
    courier_id = excluded.courier_id,
    tracking_number = excluded.tracking_number,
    status = excluded.status,
    cod_amount = excluded.cod_amount,
    courier_charges = excluded.courier_charges,
    other_deductions = excluded.other_deductions,
    delivered_at = case when excluded.status = 'delivered' then coalesce(excluded.delivered_at, shipments.delivered_at, now()) else excluded.delivered_at end,
    notes = excluded.notes
  returning id into sid;

  perform public._recompute_settlement(sid);
  return sid;
end $$;

-- Admin confirms the COD money actually arrived from the courier.
create or replace function public.admin_verify_cod(
  p_shipment uuid,
  p_received_amount numeric,
  p_settlement_date date,
  p_reference text,
  p_status public.cod_settlement_status default 'verified'
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  s public.shipments;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_status not in ('received', 'verified', 'disputed') then
    raise exception 'Invalid COD settlement status' using errcode = '22023';
  end if;
  select * into s from public.shipments where id = p_shipment for update;
  if not found then raise exception 'Shipment not found' using errcode = 'P0002'; end if;
  if s.cod_settlement_status = 'not_applicable' then
    raise exception 'This order was prepaid — no COD to settle' using errcode = 'P0001';
  end if;
  if s.status <> 'delivered' then
    raise exception 'Mark the shipment delivered before settling COD' using errcode = 'P0001';
  end if;
  if p_received_amount is null or p_received_amount < 0 then
    raise exception 'Enter the amount received' using errcode = '22023';
  end if;

  update public.shipments set
    cod_settlement_status = p_status,
    cod_received_amount = p_received_amount,
    cod_settlement_date = coalesce(p_settlement_date, current_date),
    cod_settlement_reference = nullif(trim(p_reference), ''),
    cod_verified_by = case when p_status = 'verified' then auth.uid() else cod_verified_by end,
    cod_verified_at = case when p_status = 'verified' then now() else cod_verified_at end
  where id = s.id;

  perform public._recompute_settlement(s.id);
end $$;

create or replace function public.admin_approve_settlement(p_settlement uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  st public.seller_settlements;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into st from public.seller_settlements where id = p_settlement for update;
  if not found then raise exception 'Settlement not found' using errcode = 'P0002'; end if;
  if st.status <> 'available' then
    raise exception 'Only available settlements can be approved (verify COD first)' using errcode = 'P0001';
  end if;
  update public.seller_settlements set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    notes = coalesce(nullif(trim(p_note), ''), notes)
  where id = st.id;
end $$;

create or replace function public.admin_mark_settlement_paid(
  p_settlement uuid, p_reference text, p_paid_at timestamptz default null, p_note text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  st public.seller_settlements;
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into st from public.seller_settlements where id = p_settlement for update;
  if not found then raise exception 'Settlement not found' using errcode = 'P0002'; end if;
  if st.status <> 'approved' then raise exception 'Approve the settlement before paying' using errcode = 'P0001'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'Payment reference is required' using errcode = '22023'; end if;
  update public.seller_settlements set status = 'paid', paid_amount = st.seller_payable, paid_by = auth.uid(),
    paid_at = coalesce(p_paid_at, now()), payment_reference = trim(p_reference),
    notes = coalesce(nullif(trim(p_note), ''), notes)
  where id = st.id;
  select owner_id into v_owner from public.vendors where id = st.vendor_id;
  if v_owner is not null then
    perform public.notify_user(v_owner, 'Settlement paid',
      'Rs. ' || to_char(st.seller_payable, 'FM999,999,990') || ' has been paid. Ref: ' || trim(p_reference), '/seller');
  end if;
end $$;

-- Put a settlement on hold / release it (e.g. disputed COD)
create or replace function public.admin_hold_settlement(p_settlement uuid, p_hold boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  st public.seller_settlements;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into st from public.seller_settlements where id = p_settlement for update;
  if not found then raise exception 'Settlement not found' using errcode = 'P0002'; end if;
  if st.status in ('paid', 'cancelled') then raise exception 'Settlement is already closed' using errcode = 'P0001'; end if;
  if p_hold then
    update public.seller_settlements set status = 'on_hold', notes = coalesce(nullif(trim(p_note), ''), notes) where id = st.id;
  else
    update public.seller_settlements set status = 'pending', approved_by = null, approved_at = null,
      notes = coalesce(nullif(trim(p_note), ''), notes) where id = st.id;
    perform public._recompute_settlement(st.shipment_id);
  end if;
end $$;

-- Link a signed-up account to a store as its seller.
create or replace function public.admin_link_seller(p_vendor uuid, p_email text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  uid uuid;
  cur_role public.user_role;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select id, role into uid, cur_role from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email — ask the seller to sign up first' using errcode = 'P0002'; end if;
  if cur_role in ('admin', 'rider') then
    raise exception 'That account is an % — use a separate account for the seller', cur_role using errcode = 'P0001';
  end if;
  update public.profiles set role = 'vendor' where id = uid;
  update public.vendors set owner_id = uid where id = p_vendor;
  if not found then raise exception 'Store not found' using errcode = 'P0002'; end if;
end $$;

-- Recompute every open settlement after commission settings change.
create or replace function public.admin_recompute_open_settlements()
returns int language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  for r in select shipment_id from public.seller_settlements where status in ('pending', 'available', 'on_hold') loop
    perform public._recompute_settlement(r.shipment_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Seller summary (read-only numbers for the seller dashboard)
-- ---------------------------------------------------------------------
create or replace function public.seller_balance_summary(p_vendor uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_vendor_owner(p_vendor)) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total_sales',        coalesce(sum(gross_sales) filter (where status <> 'cancelled'), 0),
      'pending_balance',    coalesce(sum(seller_payable) filter (where status in ('pending', 'on_hold')), 0),
      'available_balance',  coalesce(sum(seller_payable) filter (where status in ('available', 'approved')), 0),
      'commission',         coalesce(sum(commission_amount) filter (where status <> 'cancelled'), 0),
      'courier_deductions', coalesce(sum(courier_deductions) filter (where status <> 'cancelled'), 0),
      'total_paid',         coalesce(sum(paid_amount) filter (where status = 'paid'), 0)
    )
    from public.seller_settlements where vendor_id = p_vendor
  );
end $$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.settlement_settings enable row level security;
alter table public.couriers            enable row level security;
alter table public.shipments           enable row level security;
alter table public.seller_settlements  enable row level security;

drop policy if exists settlement_settings_admin on public.settlement_settings;
create policy settlement_settings_admin on public.settlement_settings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists couriers_admin on public.couriers;
create policy couriers_admin on public.couriers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists couriers_seller_read on public.couriers;
create policy couriers_seller_read on public.couriers for select
  using (exists (select 1 from public.vendors v where v.owner_id = auth.uid()));

-- Shipments / settlements: admins read; sellers read their own store only.
-- No insert/update/delete policies — all writes go through the admin RPCs.
drop policy if exists shipments_read on public.shipments;
create policy shipments_read on public.shipments for select
  using (public.is_admin() or public.is_vendor_owner(vendor_id));

drop policy if exists seller_settlements_read on public.seller_settlements;
create policy seller_settlements_read on public.seller_settlements for select
  using (public.is_admin() or public.is_vendor_owner(vendor_id));

-- Sellers may see their own store row (even if hidden from the storefront)
drop policy if exists vendors_owner_read on public.vendors;
create policy vendors_owner_read on public.vendors for select using (owner_id = auth.uid());

revoke insert, update, delete on public.shipments, public.seller_settlements from authenticated;
grant select on public.shipments, public.seller_settlements, public.couriers to authenticated;
grant select, insert, update, delete on public.couriers, public.settlement_settings to authenticated;

-- ---------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------
revoke execute on function public.admin_save_shipment(uuid, uuid, uuid, text, public.shipment_status, numeric, numeric, numeric, timestamptz, text) from public, anon;
revoke execute on function public.admin_verify_cod(uuid, numeric, date, text, public.cod_settlement_status) from public, anon;
revoke execute on function public.admin_approve_settlement(uuid, text) from public, anon;
revoke execute on function public.admin_mark_settlement_paid(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.admin_hold_settlement(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_link_seller(uuid, text) from public, anon;
revoke execute on function public.admin_recompute_open_settlements() from public, anon;
revoke execute on function public.seller_balance_summary(uuid) from public, anon;

grant execute on function public.admin_save_shipment(uuid, uuid, uuid, text, public.shipment_status, numeric, numeric, numeric, timestamptz, text) to authenticated;
grant execute on function public.admin_verify_cod(uuid, numeric, date, text, public.cod_settlement_status) to authenticated;
grant execute on function public.admin_approve_settlement(uuid, text) to authenticated;
grant execute on function public.admin_mark_settlement_paid(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_hold_settlement(uuid, boolean, text) to authenticated;
grant execute on function public.admin_link_seller(uuid, text) to authenticated;
grant execute on function public.admin_recompute_open_settlements() to authenticated;
grant execute on function public.seller_balance_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Starter couriers (charges are placeholders — set real rates in Admin)
-- ---------------------------------------------------------------------
insert into public.couriers (name, code, default_charge, tracking_url_template) values
  ('TCS',        'tcs',      0, null),
  ('Leopards',   'leopards', 0, null),
  ('M&P',        'mnp',      0, null),
  ('Trax',       'trax',     0, null),
  ('Other',      'other',    0, null)
on conflict (code) do nothing;

-- ===================== supabase/seed.sql =====================
-- =====================================================================
-- NEXORA — starter catalogue (from the approved Stitch screens).
-- Idempotent: rows are matched on slug/code and never overwritten.
-- Ratings and sold counts start at zero and are driven by real
-- reviews and orders.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
insert into public.delivery_settings (id, mode, base_charge, eta_min_days, eta_max_days, free_delivery_enabled, free_delivery_threshold)
values (1, 'area', 250, 3, 5, false, 3000)
on conflict (id) do nothing;

insert into public.delivery_zones (name, province, city, area, charge, eta_min_days, eta_max_days, priority)
select * from (values
  ('Karachi Metro',  'Sindh',   'Karachi',   null::text, 150::numeric, 1, 2, 10),
  ('Lahore Metro',   'Punjab',  'Lahore',    null,       200,          1, 3, 10),
  ('Islamabad',      'Islamabad Capital Territory', 'Islamabad', null, 200, 2, 3, 10),
  ('Rawalpindi',     'Punjab',  'Rawalpindi', null,      200,          2, 3, 10),
  ('Rest of Sindh',  'Sindh',   null,        null,       250,          2, 4, 0),
  ('Rest of Punjab', 'Punjab',  null,        null,       250,          2, 4, 0)
) v(name, province, city, area, charge, eta_min_days, eta_max_days, priority)
where not exists (select 1 from public.delivery_zones);

insert into public.store_settings (key, value, is_public) values
  ('store', '{"name": "NEXORA", "tagline": "Everything. One Place.", "support_phone": "", "support_whatsapp": "", "support_email": ""}', true),
  ('payment_accounts', '{
     "easypaisa": {"title": "NEXORA", "number": ""},
     "jazzcash":  {"title": "NEXORA", "number": ""},
     "bank_transfer": {"bank": "", "title": "NEXORA", "account_number": "", "iban": ""}
   }', true),
  ('trending_searches', '["iPhone 16 Pro", "Khaadi Kurta", "AirPods", "Headphones", "Charger", "Perfume"]', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Categories (8 top-level tiles from the home screen + subcategories)
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, icon, sort_order) values
  ('Electronics',   'electronics',  'devices',        1),
  ('Apparel',       'apparel',      'styler',         2),
  ('Home & Living', 'home-living',  'chair',          3),
  ('Beauty',        'beauty',       'spa',            4),
  ('Pantry',        'pantry',       'kitchen',        5),
  ('Audio & Gear',  'audio-gear',   'headphones',     6),
  ('Footwear',      'footwear',     'roller_skating', 7),
  ('Books',         'books',        'menu_book',      8)
on conflict (slug) do nothing;

insert into public.categories (parent_id, name, slug, icon, sort_order)
select p.id, v.name, v.slug, v.icon, v.sort_order
from (values
  ('electronics', 'Mobiles & Tablets',  'mobiles-tablets',  'smartphone',            1),
  ('electronics', 'Chargers & Power',   'chargers-power',   'battery_charging_full', 2),
  ('electronics', 'Wearables',          'wearables',        'watch',                 3),
  ('apparel',     'Men''s Kurta',       'mens-kurta',       'checkroom',             1),
  ('apparel',     'Women''s Lawn',      'womens-lawn',      'styler',                2),
  ('home-living', 'Kitchen Appliances', 'kitchen-appliances','microwave',            1),
  ('home-living', 'Desk & Decor',       'desk-decor',       'desk',                  2),
  ('beauty',      'Fragrances',         'fragrances',       'spa',                   1),
  ('pantry',      'Rice & Grains',      'rice-grains',      'grain',                 1),
  ('audio-gear',  'Headphones',         'headphones',       'headphones',            1),
  ('audio-gear',  'Earbuds',            'earbuds',          'earbuds',               2)
) v(parent_slug, name, slug, icon, sort_order)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Brands & official stores
-- ---------------------------------------------------------------------
insert into public.brands (name, slug, icon, short_code, is_featured, sort_order) values
  ('Apple',          'apple',          'phone_iphone',          null, true,  1),
  ('Samsung',        'samsung',        'devices_other',         null, true,  2),
  ('Khaadi',         'khaadi',         null,                    'KH', true,  3),
  ('Sapphire',       'sapphire',       null,                    'SP', true,  4),
  ('Anker',          'anker',          'battery_charging_full', null, true,  5),
  ('Xiaomi',         'xiaomi',         null,                    'MI', true,  6),
  ('Sony',           'sony',           null,                    'SO', false, 7),
  ('J. Fragrances',  'j-fragrances',   null,                    'J.', false, 8),
  ('Nordic Living',  'nordic-living',  null,                    'NL', false, 9),
  ('Bose',           'bose',           null,                    'BO', false, 10),
  ('Sennheiser',     'sennheiser',     null,                    'SE', false, 11),
  ('Marshall',       'marshall',       null,                    'MA', false, 12),
  ('Philips',        'philips',        null,                    'PH', false, 13),
  ('Guard',          'guard',          null,                    'GD', false, 14)
on conflict (slug) do nothing;

insert into public.vendors (name, slug, badge, is_official) values
  ('NEXORA Retail',           'nexora-retail',   'Verified',       true),
  ('Apple Flagship Store',    'apple-flagship',  'PTA Approved',   true),
  ('Anker Official Pakistan', 'anker-official',  '18M Warranty',   true),
  ('Sapphire Official',       'sapphire-official','Festive Edit',  true),
  ('Khaadi Official',         'khaadi-official', 'Flagship',       true),
  ('Sony Official',           'sony-official',   'Official Warranty', true),
  ('Samsung Pakistan',        'samsung-pakistan','PTA Approved',   true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Hero banner
-- ---------------------------------------------------------------------
insert into public.banners (title, subtitle, badge, image_url, cta_label, cta_link, sort_order)
select 'Summer Minimalist Living', 'Up to 40% off daily mindful design essentials.', 'Curated Editorial',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBCM5UZUcy1QFF1Y14RQyj6LFyKQQ9Nr_rcgkINqQQJRyzG4lOUx9poeQ7r3wDz7Kgcpo3GF6hASfdopAOdcQrLkoW-WZHEcysfb_6qNjuhYBR9hwDNsDkDmpViD-Uh4_rBA19SR2onT44qpuKV8K2y3I_Sdjy2kFRKDMleEgw4H5D_4eztAq2JGJRhqp79SQDrb5TMhMG7vWPHZWw2i-1d1l5Uy9TGZxQciUfWr_WNUJM79ZRKGsw',
  'Shop Collection', '/categories/home-living', 1
where not exists (select 1 from public.banners);

-- ---------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------
insert into public.coupons (code, description, discount_type, value, min_order_amount, per_user_limit, is_public) values
  ('NEXORA1ST', 'Welcome voucher — Rs. 1,000 off your first order', 'fixed',   1000, 5000, 1, true),
  ('SAVE10',    '10% off (up to Rs. 2,000)',                         'percent', 10,   3000, 3, true)
on conflict (code) do nothing;
update public.coupons set max_discount = 2000 where code = 'SAVE10' and max_discount is null;

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------
with src (slug, name, vendor, brand, category, price, compare_at, stock, badges, featured, flash, short_desc, description, specs, tags) as (
  values
  ('airpods-pro-2nd-gen', 'AirPods Pro 2nd Gen', 'apple-flagship', 'apple', 'earbuds', 54999, 68000, 40,
    array['Official Warranty'], true, true,
    'Active Noise Cancellation, Adaptive Audio and USB-C MagSafe case.',
    'Apple AirPods Pro (2nd generation) deliver up to 2x more Active Noise Cancellation, Adaptive Audio, Conversation Awareness and personalised Spatial Audio. Includes USB-C MagSafe charging case with speaker and lanyard loop.',
    '[{"label":"Chip","value":"Apple H2","detail":"Computational audio"},{"label":"Battery","value":"Up to 6 hours","detail":"30 hours with case"},{"label":"Water Resistance","value":"IP54","detail":"Earbuds & case"},{"label":"Charging","value":"USB-C / MagSafe","detail":"Qi2 compatible"}]',
    array['airpods','earbuds','apple','wireless']),
  ('khaadi-pure-linen-kurta', 'Pure Linen Kurta', 'khaadi-official', 'khaadi', 'mens-kurta', 4250, 6500, 60,
    array['New Season'], false, true,
    'Breathable sage-green pure linen kurta with brass collar button.',
    'A minimal men''s kurta tailored from pure linen for Pakistani summers. Relaxed fit, side pockets and a subtle brass collar button.',
    '[{"label":"Fabric","value":"100% Linen","detail":"Breathable weave"},{"label":"Fit","value":"Relaxed","detail":"True to size"},{"label":"Care","value":"Gentle wash","detail":"Iron medium"}]',
    array['kurta','khaadi','linen','men']),
  ('anker-nano-30w-charger', 'Nano 30W Fast Charger', 'anker-official', 'anker', 'chargers-power', 4800, 5999, 120,
    array['18M Warranty'], false, true,
    'Compact USB-C PD charger — fast charges iPhone and Android.',
    'Anker Nano 30W USB-C charger with PowerIQ 3.0. Small enough for any pocket, powerful enough to fast charge phones, tablets and small laptops.',
    '[{"label":"Output","value":"30W USB-C PD","detail":"PowerIQ 3.0"},{"label":"Size","value":"Ultra compact","detail":"Foldable plug"}]',
    array['charger','anker','usb-c','fast charging']),
  ('sony-wh-1000xm5', 'Sony WH-1000XM5 Wireless Headphones', 'sony-official', 'sony', 'headphones', 94999, 105000, 25,
    array['PTA Approved', 'Official Warranty'], true, false,
    'Industry-leading noise cancellation with 30-hour battery.',
    'Sony WH-1000XM5 wireless noise cancelling headphones with Auto NC Optimizer, eight microphones, crystal-clear calls and up to 30 hours of battery life.',
    '[{"label":"Noise Cancelling","value":"Auto NC Optimizer","detail":"8 microphones"},{"label":"Battery","value":"30 hours","detail":"3 min = 3 hrs"},{"label":"Connectivity","value":"Bluetooth 5.2","detail":"Multipoint"},{"label":"Weight","value":"250 g","detail":"Soft fit leather"}]',
    array['headphones','sony','anc','wireless']),
  ('j-janan-gold-edp-100ml', 'Janan Gold Eau de Parfum 100ml', 'nexora-retail', 'j-fragrances', 'fragrances', 8200, 9500, 80,
    array['Bestseller'], true, false,
    'Warm amber oud fragrance with a long-lasting trail.',
    'J. Janan Gold is a rich amber and oud eau de parfum crafted for special occasions. 100ml glass bottle with gold cap.',
    '[{"label":"Volume","value":"100 ml","detail":"Eau de Parfum"},{"label":"Notes","value":"Amber, Oud","detail":"Warm & woody"}]',
    array['perfume','fragrance','j.','janan']),
  ('white-oak-desk-organizer', 'Solid White Oak Desk Organizer Tray', 'nexora-retail', 'nordic-living', 'desk-decor', 3850, 4500, 35,
    array[]::text[], true, false,
    'Handcrafted solid white oak tray for pens, watch and keys.',
    'A minimalist desk organizer tray handcrafted from solid white oak. Keeps pens, watches and everyday carry neatly in place.',
    '[{"label":"Material","value":"Solid White Oak","detail":"Oil finish"},{"label":"Size","value":"30 × 12 cm","detail":"3 compartments"}]',
    array['desk','organizer','oak','home']),
  ('sapphire-egyptian-cotton-kurta-charcoal', 'Egyptian Cotton Kurta — Charcoal', 'sapphire-official', 'sapphire', 'mens-kurta', 5990, 7200, 45,
    array['New Drop'], true, false,
    'Slim-fit charcoal kurta in soft Egyptian cotton.',
    'Sapphire men''s slim-fit kurta in premium Egyptian cotton. A clean charcoal tone for everyday and festive wear.',
    '[{"label":"Fabric","value":"Egyptian Cotton","detail":"Soft handfeel"},{"label":"Fit","value":"Slim","detail":"Mandarin collar"}]',
    array['kurta','sapphire','cotton','men']),
  ('iphone-16-pro-max', 'Apple iPhone 16 Pro Max', 'apple-flagship', 'apple', 'mobiles-tablets', 484999, 519999, 0,
    array['PTA Approved', 'Official Warranty'], true, false,
    'Grade 5 titanium, A18 Pro chip and 5x telephoto camera.',
    'iPhone 16 Pro Max with a 6.9" Super Retina XDR display, A18 Pro chip, Camera Control and a 48MP Fusion camera system. PTA approved with official Mercantile 1-year warranty.',
    '[{"label":"Processor","value":"A18 Pro Bionic","detail":"6-core CPU & 16-core NPU"},{"label":"Display","value":"6.9\" OLED Super Retina","detail":"ProMotion 120Hz Always-On"},{"label":"Camera","value":"48MP Triple Fusion","detail":"5x Optical Telephoto zoom"},{"label":"Build Chassis","value":"Grade 5 Titanium","detail":"IP68 Water/Dust Resistant"}]',
    array['iphone','apple','iphone 16 pro','mobile','pta']),
  ('apple-airpods-max-space-gray', 'Apple AirPods Max (Space Gray)', 'apple-flagship', 'apple', 'headphones', 174999, 195000, 10,
    array['Official Warranty'], false, false,
    'High-fidelity audio with Active Noise Cancellation.',
    'AirPods Max combine high-fidelity audio with industry-leading Active Noise Cancellation, spatial audio and a breathable knit mesh canopy.',
    '[{"label":"Chip","value":"Apple H1","detail":"Per ear"},{"label":"Battery","value":"20 hours","detail":"ANC on"}]',
    array['airpods max','headphones','apple']),
  ('anker-soundcore-space-one', 'Anker Soundcore Space One', 'anker-official', 'anker', 'headphones', 19500, 24000, 50,
    array['Express 24h'], false, false,
    'Adaptive ANC headphones with 40-hour playtime.',
    'Soundcore Space One by Anker with 2x stronger voice reduction, LDAC hi-res wireless audio and up to 55 hours of playtime.',
    '[{"label":"ANC","value":"Adaptive","detail":"2x voice reduction"},{"label":"Battery","value":"Up to 55 hours","detail":"ANC off"}]',
    array['headphones','anker','soundcore']),
  ('bose-quietcomfort-45', 'Bose QuietComfort 45', 'nexora-retail', 'bose', 'headphones', 78500, 92000, 15,
    array['COD Available'], false, false,
    'Iconic quiet, comfort and sound with 24-hour battery.',
    'Bose QuietComfort 45 wireless noise cancelling headphones with Quiet and Aware modes, 24 hours of battery and plush comfort.',
    '[{"label":"Modes","value":"Quiet / Aware","detail":"Tap to switch"},{"label":"Battery","value":"24 hours","detail":"USB-C"}]',
    array['headphones','bose','anc']),
  ('sennheiser-accentum-plus', 'Sennheiser Accentum Plus', 'nexora-retail', 'sennheiser', 'headphones', 44999, null, 20,
    array[]::text[], false, false,
    'Hybrid ANC, touch controls and 50-hour battery.',
    'Sennheiser Accentum Plus wireless headphones with adaptive hybrid ANC, intuitive touch controls and up to 50 hours of battery life.',
    '[{"label":"Battery","value":"50 hours","detail":"Fast charge"},{"label":"Codec","value":"aptX Adaptive","detail":"Hi-res"}]',
    array['headphones','sennheiser']),
  ('marshall-major-iv', 'Marshall Major IV Wireless', 'nexora-retail', 'marshall', 'headphones', 38000, 42000, 30,
    array[]::text[], false, false,
    'Iconic on-ear design with 80+ hours of playtime.',
    'Marshall Major IV on-ear wireless headphones with wireless charging, 80+ hours of playtime and the iconic Marshall control knob.',
    '[{"label":"Battery","value":"80+ hours","detail":"Wireless charging"},{"label":"Type","value":"On-ear","detail":"Foldable"}]',
    array['headphones','marshall']),
  ('anker-67w-gan-wall-charger', '67W GaN Wall Charger', 'anker-official', 'anker', 'chargers-power', 11500, 13000, 70,
    array['18M Warranty'], false, false,
    '3-port (2C1A) ultra-compact GaN charger for laptop and phone.',
    'Anker 67W GaN charger with two USB-C and one USB-A port. Charge a MacBook, phone and earbuds at the same time.',
    '[{"label":"Output","value":"67W max","detail":"2C1A"},{"label":"Tech","value":"GaN II","detail":"Ultra compact"}]',
    array['charger','anker','gan','laptop']),
  ('sapphire-mens-fine-cotton-kurta-navy', 'Men''s Fine Cotton Kurta', 'sapphire-official', 'sapphire', 'mens-kurta', 4250, 4750, 0,
    array['Festive Edit'], false, false,
    'Navy blue 100% Egyptian cotton with minimal collar embroidery.',
    'Deep royal navy kurta in fine Egyptian cotton with minimal embroidery on the collar. Available in S to XL.',
    '[{"label":"Fabric","value":"100% Egyptian Cotton","detail":"Fine count"},{"label":"Colour","value":"Navy Blue","detail":"Minimal embroidery"}]',
    array['kurta','sapphire','navy','men']),
  ('philips-air-fryer-xxl', 'Philips Air Fryer XXL 7.2L', 'nexora-retail', 'philips', 'kitchen-appliances', 38500, 49999, 18,
    array['Official Warranty'], false, true,
    'Family-size digital air fryer with Rapid Air technology.',
    'Philips Airfryer XXL with Fat Removal technology, digital display and 7.2L capacity for family meals.',
    '[{"label":"Capacity","value":"7.2 L","detail":"Family size"},{"label":"Power","value":"2225 W","detail":"Rapid Air"}]',
    array['air fryer','philips','kitchen']),
  ('guard-supreme-kernel-basmati-5kg', 'Supreme Kernel Basmati Rice 5Kg', 'nexora-retail', 'guard', 'rice-grains', 2650, 2900, 200,
    array['Express 24h'], false, false,
    'Extra-long grain aged basmati rice, vacuum sealed.',
    'Guard Supreme Kernel Basmati — aged, extra-long grain rice with a rich aroma. 5 kg vacuum-sealed pouch.',
    '[{"label":"Weight","value":"5 kg","detail":"Vacuum sealed"},{"label":"Grain","value":"Extra long","detail":"Aged"}]',
    array['rice','basmati','pantry','grocery']),
  ('samsung-galaxy-watch-6-classic', 'Galaxy Watch 6 Classic 47mm LTE', 'samsung-pakistan', 'samsung', 'wearables', 62500, 79999, 22,
    array['PTA Approved'], true, false,
    'Rotating bezel, sapphire crystal and advanced health tracking.',
    'Samsung Galaxy Watch 6 Classic with a rotating bezel, sapphire crystal glass, LTE and advanced sleep and heart tracking.',
    '[{"label":"Size","value":"47 mm","detail":"Stainless steel"},{"label":"Connectivity","value":"LTE + Bluetooth","detail":"eSIM"}]',
    array['watch','samsung','wearable','smartwatch'])
)
insert into public.products (slug, name, vendor_id, brand_id, category_id, price, compare_at_price, stock, badges,
                             is_featured, is_flash_deal, flash_deal_ends_at, flash_deal_stock_total,
                             short_description, description, specs, tags)
select s.slug, s.name, v.id, b.id, c.id, s.price, s.compare_at, s.stock, s.badges,
       s.featured, s.flash, case when s.flash then now() + interval '7 days' end,
       case when s.flash then s.stock end,
       s.short_desc, s.description, s.specs::jsonb, s.tags
from src s
join public.vendors v on v.slug = s.vendor
join public.brands b on b.slug = s.brand
join public.categories c on c.slug = s.category
on conflict (slug) do nothing;

-- Images
insert into public.product_images (product_id, url, alt, sort_order)
select p.id, i.url, p.name, i.sort_order
from (values
  ('airpods-pro-2nd-gen', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDq4Z_3Z_4wPojjCVIt9Psj4CPlkEuiBOCjpQoYobPa9z4WpM7ehgRfs6zGADJjLBfYfGwWbWi1KSxl99-GxQ_kTfcgRQ7Yaz_eg0NP6xzPRYsNg8T85aqnVEQXWEGjsfkG8iwAYlC9aBcT9K8EBEMlfMAUiYcFNaxE_TRiUY5xklc4P1a0yYrbZaUecUeHK20RJe1RaPzCP7EtmKRmlJFqPI2p3CczcKng_-vlKQs2G1ECK82DIyQ'),
  ('airpods-pro-2nd-gen', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuABd2hEHzEy6N7vFOm0idItvu2cEyiU0VXZc8oZdf2o6_tdC0lN7-Og5yPY94onniypTIoDIzcGCClmmXj26co2GAb4QhHCC8xz8bIy5CGv_kpTldKPBHyhO71u6Gxh2Wf2NVgi7SPPcn47Pe4jUe04LN7AZ1zrZAUbHMNBfVonGwHiRvAaI8mfKOpylU2UiLoUaD5oZopU-j7z1QvzMlRPO0aaTTCvbcrUml20DQdzr9v43j6jzSQ'),
  ('khaadi-pure-linen-kurta', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiyDpQBbwzqhaHGGMuW_oa-Ff0U8H7B4kI7pmTJVBATUS9C-UJk__b4CfzUSwxnaxifWGPKpehxD_1EXpFxOAoKTEapdBeP8mGq2XrNj1agcR8cqPCvJIS3QoUBYme_5BYpZReVvujsC4RAssBLdPPuuu8khnauuvLT2KoXHTis10Oubet_zF1o2qsq4gvhQvYmAGfJk8vcYnG4M8-L6wq8h1uAuldcRJxxg2UwUq0W4aY3NYdaTw'),
  ('anker-nano-30w-charger', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBV7-5aHAKivZSslDA1vJ2DOwfV6Ulx6OSiFAJHBzNaEleAAIEn9TzFRurgtz6BBLw_VTiVzhCtLXoTy1iQmsaDrCxVxJQKy_po2IGfuK1pGR9MHchp3n1366T7TMuZRKA-KKk0b5kqpwmqD_5w0-S-Q_xH-71mBzYyy24QHNGsq_fvEFWwOcgD_nTHW3BCRZd7lJrA-oXdHyzQB-5sZgvNs-N4NHAwIph82rHps9PsERB2kzT3gro'),
  ('sony-wh-1000xm5', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaMyxteur6tosDByoH4qm8stJC9k0OhvDd0y3Yp6xeEPK7If0CcQKtvYr_4Fa7DTHUuLFfVOOXxC7otk1Zu0SMWmojIKCGXZFl6CS0JbGE-P_7W9xlpd93jg3ceCeokbucWq2GcBuSiR9fafO-6P91hYzR_ad9DlRwfmWfhLV6xIxfdMZxWNmONMBICRPew6JazN-npygCQ7Pcuu9lEEGERf7M8325ae1BDlNSWn40C7zSDR3XCZs'),
  ('sony-wh-1000xm5', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCZSTrBUHNbvXEdq0zIZ_wi0hMMwddOYQf6d0Ti9R8wuJKdJ8t5l2viv0hG8OcWGSXBX06YGEGR_PeANhub6eKeF_5xm4u45wi8N1zWaUnyErTd7nb13woZGIh86S5L8GptTI9LujujO5iydX17hlugT59Ft7XdwSXpcFGp6Qen7E18_PBCn57s42qrDSBNbpZJWIzTbSrWg9PRDDiSQF2EVXG0fiidZO0Q_XeX1_lUUrNXbtB3izE'),
  ('sony-wh-1000xm5', 2, 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4KfXsp2nVn6wwDdlyiLIErR0znYd9hTOuRSt34r6Y7Iy1jvGAXZKYGZmXNa2gswXIGyqvMa_S7rMLAlGe69cSDPqmI4_PBT0lxkNyXGTsiZRxE1yJ0ECSRzonF1DKmXjxPnaFCIkz2FkoW-BYRQS8uZznkakaGjYCIU5FTrEB985wQb8G99-JdZYukDMzykv3qHnwggV4fkilK0x9TlJz-ootG28h4Sj9EOdsDVK17H9_D8XvFYc'),
  ('j-janan-gold-edp-100ml', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhwAbfYkvK5IrPxBPYZnG_RkgMFE04qr4pwlPpfcrkJSeAv1JLhM2QXaxehF77ggzqB4BGv1LuL23yz9tdx6M4pBP3d14xqs9V4tI-WswvLDB6HtZTpxw-mYXR84pVSlpNzA86f5DDGXfZ5GVIolE_M8L6B6E2NfKCyowStPPlgxLsg8t2e5PYiO9EwL7ThioxeYv0jsrAbcMUoEYjBdyosDgZ6IsQZxIrZfu7R0WrwozmKcobBok'),
  ('j-janan-gold-edp-100ml', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfEWOXNeJNWFCMWxXFCtQdL8H7z2PETGlDJ9JSNDz9RKGT5Sitx9j8OSSt_jEJ-vmcA7fLDHBxIfFpKEK-FAWwPvlJf5oBDHXtT5PiSKZsgnF8ll5xI3zoEWucMLMTi_usUewb9_d2ZfFVaKe7Io8EyMNw54G_2HBivEDKg_hngs8l32ZS542CZ39YYgd6mL4FQPgeiKNhsj2W0VBd09-Jdvfk6QW1YhbJeZPw3n7ELFowANz33YE'),
  ('white-oak-desk-organizer', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2N95Bvn1CjBSmEGAlz8qPMfj2G5ww0eifX_v8CfwDlLJigtPkf3dk8FSSTO4cGZmpqh93ELn_iPi1oHk3qvmTvIiFtJy8hvhympT3eJvuk0fAx1R_nOGsM2sjDRWwxHL52Wg4EzsTrrtgBSSUZiZYmEHTBPziILX2y6IhJmo7ddrSUJNEk3d_9e7bTsKtWwHs4LjBdti8XJ8FsBtUlf4_XI3JrPIdm2Jcyj1-dc4Q1jLipdaoEz4'),
  ('sapphire-egyptian-cotton-kurta-charcoal', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSXzKAmwYqzGlCAosDKvchY578-3OFkki9MukhnxY7H_b7tv9Jsiu4QzgggtR5iOPb5_DltYgHwL6r8ZlfIS0_e_CA6kZnMtiR5GFAcPI_PCQCTp3a1fPcSJ5D0j1Jc2OdMehAaUpqE8Qc8OtXCyZ7WSzot8i-40QW_NodS2olyaGZf0Gkx4N3jDKwtiOBwIk_myWfkSk2WB5XM7ZNcMr1yuvZAns19uvYxP7g5e4HDbJMh7b0dsw'),
  ('sapphire-egyptian-cotton-kurta-charcoal', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRPIDVylwa16lBS7bnEKMp-Tw3ENNI5ydftrNuk_kf1w-uxekRuMEX5ex2jiC5Xc-xpGLH4ohKT54dohTjug_XJ2d-c6E2gl0XBSIHDrqOKhbxoN4JJ-8I-F6BYgHGxeCdxCieUEXhAA_RzeBvO33PSU8PhqlDzJKp_GPTI1OFwLvVx4mLjAFJgXSfTZAWkqNj2wkLSmXEy9GXt0JSoJrxEbJ73SnMmzvjJ9zxnChLeuEi-f9FUpM'),
  ('iphone-16-pro-max', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfrY2ccbkEQ0Vmla_WHoJWt1lnYT_1ZiLYMDpdM3pPYNPTbWIJJL7zfRNQUJ2hRV0SadI5SGfuPUph-hy-ZoI_aZK_x_K5lNO7KMu5O3QGJn-wbI9EMwBsxdnNYq78EtVZY6bxWx0V8cTA_aZTal8UKw-3FhTjARAnCF8VrQ30LTJf5pORZtWV6zJLy7zmy-TOaIqYasAHbrD2R7VuNHSN99J9QtzWFMJkXvgjpnHgmIvOY9HnNrY'),
  ('iphone-16-pro-max', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCT_sgyMDe3hcNOzE6RevNLCJGYo8DKILpzB_EhaTtOwlEQ0-dpy8QiLlJ7pFdS1YttWPxWzrbMWeRkDSZElZsq2-PE0yYC3fzCBDLHgQEp3wEaLs0RrlO9DsrBmINfUFHVeIvGQYAIRjmT8SZXyltCWvl3-IET8_cDbI-EM2K3N_o76U5RO9eiSJpXtQqPgKoFTCW-8FzOcPDK2RYVNBxMJ8Vskyc0h2pdhye5DsIQX7EhDS-t0ac'),
  ('iphone-16-pro-max', 2, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXdx7PUMArFYuw6FMcHNhBjG0Opxl7e9wfwM9f9nZzsQ32W-NQAOJyrfTI6i9NU_EHjo89iRNh-_syeKTFAkMibbMSB6CzCkzpnPMbGu1CixxWDGW3b_rB605kaU6wUL6LjeSuet3O8nexalSZDQVpp_9ydRa2hPiNDMeBljAQ9I0hTjLsOroIGmnYB8eCnlG4W_mq_pOOFn3RtF7uC0lCwcZfkYxJfb8HdNhuutFOFEPQ1oEwVQk'),
  ('apple-airpods-max-space-gray', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfI-ilRyz32gedp-k08-5oBtIziAOixN3VgL3yfctjqG8EnqeLUf2smUNkhm0B6My6S7sfjXfNC1O7Wkx_8K6LrdXLkLrrQdd_8kXQ-aEJDg1rZ71P-wkA3HPzljKTvW1Pw9VBA73E7LqNzNk9mXeORpNRpohBwCw9Gt2SjxHCU9t-RVw-kfzR59vd9CHTNFGKKsXV4yhFLyh4aaFBbVjc4s0J5vb-fneVsMxSfTyMTdTTdaZTXZ0'),
  ('anker-soundcore-space-one', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDec3MUsphUfTpeO_0wjAP7ReEd16XH_xfpQRPuWKDQK68khQ7ioP8TQP29RUU6jb9bFJgs3Zy3hohqwRbIs-6MsiaY5y6sTq8Zuia7hubgDdPF42xxfqi25vByWpcv_YUOfQgUlmWLueocUemgv_YxLoF5Xj1wDgGbs1yoAYOcZu5GDatN-bq79CTR4O-FUhO7EmooYZPNpy-pWzER80eKDBst61PWbK2swTyMsThrZnlGA2taiDY'),
  ('anker-soundcore-space-one', 1, 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3b5pQ1JfInOapEFcm7ov4H4V25Sxzxt3volHM26fX9Vn6NoCkO8gBhMA5X_kRv0KorqExbu97hBm66TRstRgWK_8mpNHorLnIftCUR0Kq7zKURuDbaoRl_WUdzmmrcOyqGzIoyBZl_i0RVf0munvfOKrecF2SeHrfTyVHmUEui8YEfVyYchE14yHQOvHSQy3SM5uxnAOgT-81_Y4RFTXmID24wrX4RC_RyoGxK8NUl9W_aAHXEa0'),
  ('bose-quietcomfort-45', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuADVCDRVsCiE2duufq2il94yU6mPHLjD2o5SXe7i97wEK7VytnG_wXIRqfrsT7VG2N6gwACh4IvCkvngOUav0TB8shcOjr7cwADWYxADxNpOD3X_VqX7YDdR-QrQ4Dn4VA-NO2e2nyaVAOmPGl7jemvQJWAVJ8l9Qe-PL-wlIbvV7AH3K5ArweKsz0Gqqz5Yj8dCuOPkIXVcDghi-kuVFBJTHTPkgXjSrvi1FRaJez2BjhFwezj4Jg'),
  ('sennheiser-accentum-plus', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAioyRzYJk910igDKlI98fc6ImC5kVStAvadvFIb1CM_X7IjmB5CbOlcUYYw_Wk79T-KYNicW-E82gimQT3f-IonTGIrnOwc4nEZ54ImW4qIAd09leJIPMqGGvR9yWt4qqEiyjXJ3qo7IH8lJ5430_9h_V82pavOTtoxHvEARgs_G2kDvC7-UStBikNhwqtK-bvtdrbKxGr9ZHkw30tD75r1J4rMdyrtwKReDXqa9WeUM8u2V2Is5Q'),
  ('marshall-major-iv', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhpAnA6s6G5780DcoZhNM3-bioE6Lwo_1tp-PGWAEWrfwCQu4uz10ZGgCaFQLJIZolyzs7CRXm_cw4F3OCxMH_2QCUJu2u8VokWwIwPlz5d1V4MkrIsXmpgdwc70lz0uJQChvW83P_nNixT1HbXNuSX2u2PQJIc-w1FiKx26bxqg0zmcLvxJQmSSP5wjDCwimoeaJhWzZSUG6pTJGYleSHewapjdKK9VbaD4abxIGUVevpxFq4xpY'),
  ('anker-67w-gan-wall-charger', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVyizbru8_UmVcvkbrgWGRXjFGe1kPSSVul14bOqI2QlezApwRO3ipYvTf_ea9WrFr7nQgM-oL4tY5i9UQpH2J4yj7XZwOXcxpyTdcLf3YUsmacd6JGMrEDVqmwFFKdAiA5GpRYEr8YMVeP91DjE2X2egvkSL4MsVHh1zbjTOy3MK9CutVzyoV9NtS_qR7UTBWv0-WBrDFZ5tZQnZm0HxSS8ZiOzRWUEfJvD6e2XSwMIwqglptIPU'),
  ('sapphire-mens-fine-cotton-kurta-navy', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwM3AYLe_zjB8nlN5Eex2OXeQGB4oaHKRvKluUGUZNKwwpea9ib7xoEb5Beyx0sh-eDgyDtDqMXg9SSB0iZ2uABiTOnONFm6dbQv23dG9DvtPvFdN0WNxDOSTxpz_2xC3IsSbbT68tBXDuSZvPcubvDvW1sIsX1Htqj4ml1B8e0MhJBEIL9KtzhNLO0gQW65iQDk8JLCYM1jtosCUmcsvN7scxutC2HZPMpa6Jb5wR7sM55Izdy3E'),
  ('philips-air-fryer-xxl', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBy-DJcpJAloPavc3Xp-ILFqrRrUtB8TeG-OJywtwUyan_UwfqqPLjsxTeaHBCp_lFDZJ6KMK8jlQ8A3TUz-taO8q3sPndgD30KVtJ1Ufnm1IrPfAgw9z9wvd1tpfzEmYGmFyq6MY6cp9z9Hf2MNOhAFrhI399KXTKlL6yUJ8fj2mirhrvBi4NaAGmaFjxG53CNu5Pj4uFwiSlPQ2rxf0jEzaJ_Fyd_m7wg7aPIQvmp73KLAxWlqzM'),
  ('guard-supreme-kernel-basmati-5kg', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCnW_dzDLe1tbu2C_U97zD8u-ul6Olab6m-ak-Grbr9iESwZbcyg6c6aesUdResuAgU3zLuUfDs_0TFEi9USC8CFabw8ZjoSqOzcWkGRVZSvMF2-R6byqerbenFXZgl6N7tYKQZSN6OCO4edtAolfR7AvfdQ_fRKG68C88LsGP8i9UHo5q--fipwSbqhvEwbnil3Wtc7B0zXIXEWkSJsrc-OyNUpULpxFrjV81GBa4F4QpGsyh9XEk'),
  ('samsung-galaxy-watch-6-classic', 0, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhr2ie6I7g-gA6V8YQE2h15MT8KDTjLB9YPnaS7VkFsquRVGPBg4qLt7lyEpOSMmLtDpWnwFfq89DEjkFVZkig9SGthKa8FCUij_8FUG0dzKf0Jt2K6R4OD1tk7_Q0-izu7ZnsBLvdWUUNJx_ZzjnWWTnHk7LRNv2wUlbsNEUa7RJlOERH3SKLFXH3QT5jrTLuSL32nCtXBxOO7YhSgAGevaLRDujBqxzYO9NuuuxyMzhMfvHCXt8')
) i(slug, sort_order, url)
join public.products p on p.slug = i.slug
where not exists (select 1 from public.product_images pi where pi.product_id = p.id);

-- Variants: iPhone 16 Pro Max (finish × storage)
insert into public.product_variants (product_id, label, options, color_hex, price, compare_at_price, stock, sort_order)
select p.id, f.finish || ' / ' || s.storage,
       jsonb_build_object('Finish', f.finish, 'Storage', s.storage),
       f.hex, s.price, s.compare_at, 8, f.ord * 10 + s.ord
from public.products p
cross join (values ('Natural Titanium', '#9c9589', 1), ('White Titanium', '#e3e4e5', 2),
                   ('Desert Titanium', '#c5b49e', 3), ('Black Titanium', '#3b3a3e', 4)) f(finish, hex, ord)
cross join (values ('256 GB', 484999::numeric, 519999::numeric, 1), ('512 GB', 544999, 579999, 2),
                   ('1 TB', 614999, 649999, 3)) s(storage, price, compare_at, ord)
where p.slug = 'iphone-16-pro-max'
  and not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- Variants: Sapphire navy kurta (size)
insert into public.product_variants (product_id, label, options, price, compare_at_price, stock, sort_order)
select p.id, 'Size ' || sz.size, jsonb_build_object('Size', sz.size), 4250, 4750, 12, sz.ord
from public.products p
cross join (values ('S', 1), ('M', 2), ('L', 3), ('XL', 4)) sz(size, ord)
where p.slug = 'sapphire-mens-fine-cotton-kurta-navy'
  and not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- Keep parent stock in sync with variant stock for display
update public.products p set stock = sub.total
from (select product_id, sum(stock) total from public.product_variants group by product_id) sub
where sub.product_id = p.id and p.stock = 0;
