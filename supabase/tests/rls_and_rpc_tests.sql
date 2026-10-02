-- =====================================================================
-- NEXORA — security & workflow tests (run via tests/run_local.sh)
-- Each block impersonates a user by setting role + request.jwt.claim.sub
-- exactly like PostgREST does. Any failed assertion aborts the run.
--   ...0a = customer Ali     ...0b = customer Sara
--   ...ad = admin            ...e1 / ...e2 = riders
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ali@example.com',    '{"full_name": "Ali Khan"}'),
  ('00000000-0000-0000-0000-00000000000b', 'sara@example.com',   '{"full_name": "Sara Ahmed"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com',  '{"full_name": "Admin"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'rider1@example.com', '{"full_name": "Rider One"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'rider2@example.com', '{"full_name": "Rider Two"}');

-- bootstrap admin exactly as documented in README (SQL editor, no JWT)
update public.profiles set role = 'admin' where email = 'admin@example.com';

-- ---------------------------------------------------------------------
\echo '1. profile trigger created profiles'
do $$ begin
  assert (select count(*) from public.profiles) = 5, 'profiles not created';
  assert (select full_name from public.profiles where email = 'ali@example.com') = 'Ali Khan', 'name not copied';
end $$;

-- ---------------------------------------------------------------------
\echo '2. admin promotes riders via RPC'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.admin_set_user_role('00000000-0000-0000-0000-0000000000e1', 'rider');
select public.admin_set_user_role('00000000-0000-0000-0000-0000000000e2', 'rider');
reset role;
do $$ begin
  assert (select count(*) from public.riders where is_active) = 2, 'riders not created';
end $$;

-- ---------------------------------------------------------------------
\echo '3. anon can browse catalogue but not private data'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.products) = 18, 'anon cannot read products';
  assert (select count(*) from public.categories) >= 8, 'anon cannot read categories';
  assert (select count(*) from public.coupons) = 2, 'anon should see public coupons';
end $$;
do $$ begin
  perform count(*) from public.orders;
  raise exception 'anon read orders';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.place_order('[]', '{}', '{}', 'cod');
  raise exception 'anon could call place_order';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '4. customer cannot escalate own role'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'customer became admin';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.profiles set email = 'admin@example.com' where id = auth.uid();
  raise exception 'customer changed profile email';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.profiles set phone = '03001234567' where id = auth.uid();
  assert (select phone from public.profiles where id = auth.uid()) = '03001234567', 'own profile update failed';
  -- cannot see other profiles
  assert (select count(*) from public.profiles) = 1, 'customer sees other profiles';
  -- cannot write catalogue
  update public.products set price = 1;
  assert (select min(price) from public.products) > 1, 'customer changed prices';
end $$;
do $$ begin
  perform public.admin_dashboard_stats();
  raise exception 'customer read admin stats';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.orders (order_number, user_id, customer_name, customer_phone, province, city, area, address_line,
                             subtotal, total, payment_method)
  values ('X', auth.uid(), 'x', 'x', 'x', 'x', 'x', 'x', 1, 1, 'cod');
  raise exception 'customer inserted order directly';
exception when insufficient_privilege then null; end $$;

-- ---------------------------------------------------------------------
\echo '5. place_order prices server-side, applies coupon + delivery, reserves stock'
create temp table t_order (id uuid, num text);
grant all on t_order to authenticated;
do $$
declare
  r jsonb;
  iphone uuid := (select id from public.products where slug = 'iphone-16-pro-max');
  var uuid := (select id from public.product_variants where product_id = (select id from public.products where slug = 'iphone-16-pro-max') and label = 'Black Titanium / 512 GB');
  kurta uuid := (select id from public.products where slug = 'khaadi-pure-linen-kurta');
  o public.orders;
begin
  r := public.place_order(
    jsonb_build_array(
      jsonb_build_object('product_id', iphone, 'variant_id', var, 'quantity', 1, 'price', 1),   -- 'price' must be ignored
      jsonb_build_object('product_id', kurta, 'quantity', 2)),
    '{"full_name": "Ali Khan", "phone": "03001234567", "whatsapp": "0300 1234567", "email": "ali@example.com"}',
    '{"province": "Sindh", "city": "Karachi", "area": "Clifton", "address_line": "House 12, Street 4, Block 5", "landmark": "Near Dolmen Mall"}',
    'cod', null, 'nexora1st', 'Call before delivery', true);
  select * into o from public.orders where id = (r ->> 'order_id')::uuid;
  assert o.subtotal = 544999 + 2 * 4250, 'subtotal wrong: ' || o.subtotal;
  assert o.discount_total = 1000, 'coupon not applied';
  assert o.delivery_charge = 150, 'karachi delivery charge wrong';
  assert o.total = 544999 + 8500 - 1000 + 150, 'total wrong';
  assert o.status = 'placed' and o.payment_status = 'pending', 'initial status wrong';
  assert o.estimated_delivery_from = current_date + 1, 'eta wrong';
  assert (select count(*) from public.order_items where order_id = o.id) = 2, 'items missing';
  assert (select count(*) from public.addresses where user_id = auth.uid() and is_default) = 1, 'address not saved';
  assert (select count(*) from public.notifications where user_id = auth.uid()) = 1, 'notification missing';
  insert into t_order values (o.id, o.order_number);
end $$;
reset role;
do $$ begin
  assert (select stock from public.product_variants where label = 'Black Titanium / 512 GB') = 7, 'variant stock not reserved';
  assert (select stock from public.products where slug = 'iphone-16-pro-max') = 95, 'parent stock not synced';
  assert (select stock from public.products where slug = 'khaadi-pure-linen-kurta') = 58, 'stock not reserved';
  assert (select used_count from public.coupons where code = 'NEXORA1ST') = 1, 'coupon usage not counted';
end $$;

\echo '6. coupon per-user limit, oversell and missing variant are rejected'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert not (select valid from public.validate_coupon('NEXORA1ST', 10000)), 'coupon reusable';
  perform public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'apple-airpods-max-space-gray'), 'quantity', 11)),
    '{"full_name": "Ali Khan", "phone": "03001234567"}',
    '{"province": "Sindh", "city": "Karachi", "area": "Clifton", "address_line": "House 12, Street 4"}', 'cod');
  raise exception 'oversold';
exception when sqlstate 'P0001' then null; end $$;
do $$ begin
  perform public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'iphone-16-pro-max'), 'quantity', 1)),
    '{"full_name": "Ali Khan", "phone": "03001234567"}',
    '{"province": "Sindh", "city": "Karachi", "area": "Clifton", "address_line": "House 12, Street 4"}', 'cod');
  raise exception 'ordered product without choosing variant';
exception when sqlstate '22023' then null; end $$;
do $$ begin
  perform public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'marshall-major-iv'), 'quantity', 1)),
    '{"full_name": "Ali Khan", "phone": "12345"}',
    '{"province": "Sindh", "city": "Karachi", "area": "Clifton", "address_line": "House 12, Street 4"}', 'cod');
  raise exception 'bad phone accepted';
exception when sqlstate '22023' then null; end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '7. second customer cannot see first customer''s order'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.orders) = 0, 'Sara sees Ali''s order';
  assert (select count(*) from public.order_items) = 0, 'Sara sees Ali''s items';
  assert (select count(*) from public.addresses) = 0, 'Sara sees Ali''s address';
  assert (select count(*) from public.notifications) = 0, 'Sara sees Ali''s notifications';
end $$;
do $$ begin
  perform public.cancel_my_order((select id from t_order));
  raise exception 'Sara cancelled Ali''s order';
exception when sqlstate 'P0002' then null; end $$;
-- Sara places her own (bank transfer, with reference -> awaiting verification, Lahore)
do $$
declare r jsonb;
begin
  r := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'sony-wh-1000xm5'), 'quantity', 1)),
    '{"full_name": "Sara Ahmed", "phone": "+923211234567"}',
    '{"province": "Punjab", "city": "Lahore", "area": "Gulberg III", "address_line": "45-B Main Boulevard"}',
    'bank_transfer', 'TXN-778899');
  assert (select payment_status from public.orders where id = (r ->> 'order_id')::uuid) = 'awaiting_verification', 'bank transfer status';
  assert (select delivery_charge from public.orders where id = (r ->> 'order_id')::uuid) = 200, 'lahore charge';
end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '8. rider sees nothing until assigned; admin assigns rider 1'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  assert (select count(*) from public.orders) = 0, 'unassigned rider sees orders';
end $$;
do $$ begin
  perform public.admin_assign_rider((select id from t_order), auth.uid());
  raise exception 'rider assigned himself';
exception when insufficient_privilege then null; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$ begin
  assert (select count(*) from public.orders) = 2, 'admin cannot see all orders';
  perform public.admin_update_order_status((select id from t_order), 'confirmed', 'Confirmed by phone');
  perform public.admin_update_order_status((select id from t_order), 'processing', null);
  perform public.admin_assign_rider((select id from t_order), '00000000-0000-0000-0000-0000000000e1');
  assert (select status from public.orders where id = (select id from t_order)) = 'assigned', 'not assigned';
  assert (public.admin_dashboard_stats() ->> 'orders_total')::int = 2, 'stats';
end $$;

-- ---------------------------------------------------------------------
\echo '9. rider 2 cannot see or touch rider 1''s order'
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  assert (select count(*) from public.orders) = 0, 'rider 2 sees rider 1 order';
  assert (select count(*) from public.order_items) = 0, 'rider 2 sees items';
end $$;
do $$ begin
  perform public.rider_update_order((select id from t_order), 'accept');
  raise exception 'rider 2 accepted rider 1 order';
exception when sqlstate 'P0002' then null; end $$;

-- ---------------------------------------------------------------------
\echo '10. rider 1 workflow is enforced step by step'
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'rider 1 cannot see assigned order';
  assert (select count(*) from public.order_items) = 2, 'rider 1 cannot see items';
  assert (select count(*) from public.profiles) = 1, 'rider sees customer profiles';
  assert (select count(*) from public.payments) = 0, 'rider sees payments table';
  -- direct update is blocked by RLS (no rows affected)
  update public.orders set status = 'delivered';
  assert (select status from public.orders) = 'assigned', 'rider updated order directly';
end $$;
do $$ begin
  perform public.rider_update_order((select id from t_order), 'picked_up');
  raise exception 'picked up before accepting';
exception when sqlstate 'P0001' then null; end $$;
do $$ begin
  perform public.rider_update_order((select id from t_order), 'accept');
  perform public.rider_update_order((select id from t_order), 'picked_up');
  perform public.rider_update_order((select id from t_order), 'on_the_way');
  perform public.rider_update_order((select id from t_order), 'delivered');
  assert (select status from public.orders) = 'delivered', 'not delivered';
  -- delivered ≠ COD received: cash is with the rider until NEXORA verifies it
  assert (select payment_status from public.orders) = 'awaiting_verification', 'COD must be collected, not paid, on delivery';
end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '11. customer sees full tracking history; can review delivered product'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select count(*) from public.order_status_history where order_id = (select id from t_order)) >= 7, 'history incomplete';
  insert into public.reviews (product_id, user_id, rating, body, is_approved, is_verified_purchase)
  values ((select id from public.products where slug = 'khaadi-pure-linen-kurta'), auth.uid(), 5, 'Great fabric', true, true);
  assert (select is_verified_purchase from public.reviews where user_id = auth.uid()) = true, 'verified purchase flag';
  assert (select rating_avg from public.products where slug = 'khaadi-pure-linen-kurta') = 5.0, 'rating aggregate';
end $$;
do $$ begin
  perform public.cancel_my_order((select id from t_order));
  raise exception 'cancelled delivered order';
exception when sqlstate 'P0001' then null; end $$;
reset role;

-- Sara reviews something she never bought -> not verified
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  insert into public.reviews (product_id, user_id, rating, body, is_verified_purchase, author_name)
  values ((select id from public.products where slug = 'khaadi-pure-linen-kurta'), auth.uid(), 3, 'Nice', true, 'NEXORA Official');
  assert (select is_verified_purchase from public.reviews where user_id = auth.uid()) = false, 'fake verified purchase';
  assert (select author_name from public.reviews where user_id = auth.uid()) = 'Sara Ahmed', 'author name spoofed';
  -- cancel own order restocks
  perform public.cancel_my_order((select id from public.orders limit 1), 'Changed my mind');
  assert (select status from public.orders limit 1) = 'cancelled', 'cancel failed';
end $$;
reset role;
do $$ begin
  assert (select stock from public.products where slug = 'sony-wh-1000xm5') = 25, 'cancel did not restock';
end $$;

\echo 'ALL TESTS PASSED'
