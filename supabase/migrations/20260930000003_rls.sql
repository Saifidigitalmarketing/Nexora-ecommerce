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
