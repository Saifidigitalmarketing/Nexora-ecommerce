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
