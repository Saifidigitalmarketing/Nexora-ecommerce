-- =====================================================================
-- NEXORA — courier, COD and seller settlement tests
-- Runs after rls_and_rpc_tests.sql (reuses its users and data).
--   ...ad = admin   ...0a = customer Ali   ...5e / ...5f = sellers
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000005e', 'seller.sapphire@example.com', '{"full_name": "Sapphire Seller"}'),
  ('00000000-0000-0000-0000-00000000005f', 'seller.anker@example.com',    '{"full_name": "Anker Seller"}');

\echo 'S1. admin links sellers, sets commission (10% default, Anker fixed Rs. 300)'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.admin_link_seller((select id from public.vendors where slug = 'sapphire-official'), 'seller.sapphire@example.com');
select public.admin_link_seller((select id from public.vendors where slug = 'anker-official'), 'SELLER.ANKER@example.com');
update public.settlement_settings set default_commission_type = 'percent', default_commission_value = 10 where id = 1;
update public.vendors set commission_type = 'fixed', commission_value = 300 where slug = 'anker-official';
update public.couriers set default_charge = 250 where code = 'tcs';
reset role;
do $$ begin
  assert (select role from public.profiles where email = 'seller.sapphire@example.com') = 'vendor', 'seller role not set';
end $$;

\echo 'S2. customer places a COD order with items from two sellers'
create temp table t_s (id uuid);
grant all on t_s to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$
declare r jsonb;
begin
  r := public.place_order(
    jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where slug = 'sapphire-egyptian-cotton-kurta-charcoal'), 'quantity', 1),
      jsonb_build_object('product_id', (select id from public.products where slug = 'anker-nano-30w-charger'), 'quantity', 1)),
    '{"full_name": "Ali Khan", "phone": "03001234567"}',
    '{"province": "Sindh", "city": "Karachi", "area": "Clifton", "address_line": "House 12, Street 4"}', 'cod');
  insert into t_s values ((r ->> 'order_id')::uuid);
end $$;
-- customer cannot book shipments or see settlements
do $$ begin
  perform public.admin_save_shipment((select id from t_s), (select id from public.vendors where slug = 'sapphire-official'), null, 'X', 'booked', 1, 0, 0);
  raise exception 'customer created shipment';
exception when insufficient_privilege then null; end $$;
do $$ begin
  assert (select count(*) from public.seller_settlements) = 0, 'customer sees settlements';
end $$;
reset role;

\echo 'S3. admin books courier shipments; settlements start as pending'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$
declare tcs uuid := (select id from public.couriers where code = 'tcs');
begin
  perform public.admin_save_shipment((select id from t_s), (select id from public.vendors where slug = 'sapphire-official'),
    tcs, 'TCS123456', 'booked', 5990 + 150, 250, 0);
  perform public.admin_save_shipment((select id from t_s), (select id from public.vendors where slug = 'anker-official'),
    tcs, 'TCS123457', 'booked', 4800, 250, 50);
  assert (select count(*) from public.seller_settlements where order_id = (select id from t_s) and status = 'pending') = 2, 'settlements not pending';
end $$;
do $$ begin
  perform public.admin_verify_cod((select id from public.shipments where tracking_number = 'TCS123456'), 6140, current_date, 'TCS-REMIT-1');
  raise exception 'verified COD before delivery';
exception when sqlstate 'P0001' then null; end $$;
do $$ begin
  perform public.admin_approve_settlement((select id from public.seller_settlements limit 1));
  raise exception 'approved before COD verified';
exception when sqlstate 'P0001' then null; end $$;
reset role;

\echo 'S4. math: Sapphire 5,990 - 250 courier - 10% (599) = 5,141; Anker 4,800 - 300 courier - Rs.300 = 4,200'
do $$ begin
  assert (select seller_payable from public.seller_settlements s join public.vendors v on v.id = s.vendor_id where v.slug = 'sapphire-official') = 5141, 'sapphire payable';
  assert (select commission_amount from public.seller_settlements s join public.vendors v on v.id = s.vendor_id where v.slug = 'sapphire-official') = 599, 'sapphire commission';
  assert (select seller_payable from public.seller_settlements s join public.vendors v on v.id = s.vendor_id where v.slug = 'anker-official') = 4200, 'anker payable';
end $$;

\echo 'S5. sellers see only their own store and cannot edit anything'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005e', false);
do $$ begin
  assert (select count(*) from public.seller_settlements) = 1, 'seller sees other sellers settlements';
  assert (select count(*) from public.shipments) = 1, 'seller sees other shipments';
  assert (public.seller_balance_summary((select id from public.vendors where slug = 'sapphire-official')) ->> 'pending_balance')::numeric = 5141, 'pending balance';
  update public.seller_settlements set seller_payable = 999999, status = 'paid';
  assert (select seller_payable from public.seller_settlements) = 5141, 'seller edited payable';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.shipments set cod_amount = 1;
  raise exception 'seller updated shipment';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.seller_balance_summary((select id from public.vendors where slug = 'anker-official'));
  raise exception 'seller read another store summary';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.vendors set commission_value = 0 where slug = 'sapphire-official';
  assert (select commission_value from public.vendors where slug = 'sapphire-official') is null, 'seller changed commission';
end $$;
do $$ begin
  perform public.admin_mark_settlement_paid((select id from public.seller_settlements limit 1), 'SELF');
  raise exception 'seller paid himself';
exception when insufficient_privilege then null; end $$;
reset role;

\echo 'S6. deliver → verify COD → available → approve → paid'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$
declare
  sh uuid := (select id from public.shipments where tracking_number = 'TCS123456');
  st uuid;
begin
  perform public.admin_save_shipment((select id from t_s), (select id from public.vendors where slug = 'sapphire-official'),
    (select id from public.couriers where code = 'tcs'), 'TCS123456', 'delivered', 6140, 250, 0);
  perform public.admin_verify_cod(sh, 5890, current_date, 'TCS-REMIT-1');
  select id into st from public.seller_settlements where shipment_id = sh;
  assert (select status from public.seller_settlements where id = st) = 'available', 'not available after COD verify';
  -- amounts are locked once COD is verified
  begin
    perform public.admin_save_shipment((select id from t_s), (select id from public.vendors where slug = 'sapphire-official'),
      (select id from public.couriers where code = 'tcs'), 'TCS123456', 'delivered', 1, 0, 0);
    raise exception 'changed amounts after verification';
  exception when sqlstate 'P0001' then null; end;
  perform public.admin_approve_settlement(st);
  begin
    perform public.admin_mark_settlement_paid(st, '  ');
    raise exception 'paid without reference';
  exception when sqlstate '22023' then null; end;
  perform public.admin_mark_settlement_paid(st, 'IBFT-778899');
  assert (select status from public.seller_settlements where id = st) = 'paid', 'not paid';
  assert (select paid_amount from public.seller_settlements where id = st) = 5141, 'paid amount wrong';
  -- commission change after payment does not alter paid settlements
  update public.settlement_settings set default_commission_value = 20 where id = 1;
  perform public.admin_recompute_open_settlements();
  assert (select seller_payable from public.seller_settlements where id = st) = 5141, 'paid settlement changed';
end $$;
reset role;

\echo 'S7. seller summary after payout'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000005e', false);
do $$
declare j jsonb := public.seller_balance_summary((select id from public.vendors where slug = 'sapphire-official'));
begin
  assert (j ->> 'total_paid')::numeric = 5141, 'total paid';
  assert (j ->> 'available_balance')::numeric = 0, 'available';
  assert (j ->> 'total_sales')::numeric = 5990, 'total sales';
  assert (select count(*) from public.notifications where title = 'Settlement paid') = 1, 'seller not notified';
end $$;
reset role;

\echo 'S8. COD rule: delivered is not "COD received by NEXORA"'
-- the two-seller order: only Sapphire's COD is verified, so the order is not paid yet
do $$ begin
  assert (select payment_status from public.orders where id = (select id from t_s)) <> 'paid', 'order paid before all COD verified';
end $$;
create temp table t_r (k text primary key, id uuid);
grant all on t_r to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare r jsonb;
begin
  r := public.place_order(jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'anker-nano-30w-charger'), 'quantity', 1)),
    '{"full_name": "Sara Ahmed", "phone": "03011234567"}', '{"province": "Punjab", "city": "Lahore", "area": "Gulberg", "address_line": "House 1, Main Blvd"}', 'cod');
  insert into t_r values ('rider', (r ->> 'order_id')::uuid);
  r := public.place_order(jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'anker-nano-30w-charger'), 'quantity', 1)),
    '{"full_name": "Sara Ahmed", "phone": "03011234567"}', '{"province": "Punjab", "city": "Lahore", "area": "Gulberg", "address_line": "House 1, Main Blvd"}', 'cod');
  insert into t_r values ('courier', (r ->> 'order_id')::uuid);
  r := public.place_order(jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'anker-nano-30w-charger'), 'quantity', 1)),
    '{"full_name": "Sara Ahmed", "phone": "03011234567"}', '{"province": "Punjab", "city": "Lahore", "area": "Gulberg", "address_line": "House 1, Main Blvd"}', 'easypaisa', 'EP1234567890');
  insert into t_r values ('prepaid', (r ->> 'order_id')::uuid);
end $$;

-- (a) NEXORA rider flow
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.admin_assign_rider((select id from t_r where k = 'rider'), '00000000-0000-0000-0000-0000000000e1');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$
declare o uuid := (select id from t_r where k = 'rider');
begin
  perform public.rider_update_order(o, 'accept');
  perform public.rider_update_order(o, 'picked_up');
  perform public.rider_update_order(o, 'on_the_way');
  perform public.rider_update_order(o, 'delivered');
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$
declare
  o uuid := (select id from t_r where k = 'rider');
  sh uuid;
begin
  assert (select payment_status from public.orders where id = o) = 'awaiting_verification', 'rider delivery marked COD paid';
  assert (select status from public.payments where order_id = o) = 'awaiting_verification', 'payment row paid on delivery';
  assert (select meta ->> 'collected_by' from public.payments where order_id = o) = 'rider', 'collection not recorded';
  sh := public.admin_save_shipment(o, (select id from public.vendors where slug = 'anker-official'),
    (select id from public.couriers where code = 'nexora_rider'), 'RIDER-1', 'delivered', 5000, 0, 0);
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'payable before cash handover verified';
  perform public.admin_verify_cod(sh, 5000, current_date, 'HANDOVER-1', 'received');
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'payable on unverified handover';
  assert (select payment_status from public.orders where id = o) = 'awaiting_verification', 'paid on unverified handover';
  perform public.admin_verify_cod(sh, 5000, current_date, 'HANDOVER-1', 'verified');
  assert (select status from public.seller_settlements where shipment_id = sh) = 'available', 'not payable after verify';
  assert (select payment_status from public.orders where id = o) = 'paid', 'order not paid after COD verified';
  -- withdrawing the verification (dispute) reverses both
  perform public.admin_verify_cod(sh, 4000, current_date, 'HANDOVER-1', 'disputed');
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'still payable after dispute';
  assert (select payment_status from public.orders where id = o) = 'awaiting_verification', 'still paid after dispute';
  perform public.admin_verify_cod(sh, 5000, current_date, 'HANDOVER-1', 'verified');
  perform public.admin_approve_settlement((select id from public.seller_settlements where shipment_id = sh));
  -- locked once approved
  begin
    perform public.admin_verify_cod(sh, 1, current_date, 'X', 'disputed');
    raise exception 'COD changed after settlement approved';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- (b) external courier flow: admin marks the order delivered
do $$
declare
  o uuid := (select id from t_r where k = 'courier');
  sh uuid;
begin
  perform public.admin_update_order_status(o, 'confirmed', null);
  sh := public.admin_save_shipment(o, (select id from public.vendors where slug = 'anker-official'),
    (select id from public.couriers where code = 'tcs'), 'TCS-S8', 'delivered', 5000, 250, 0);
  perform public.admin_update_order_status(o, 'delivered', 'Delivered by TCS');
  assert (select payment_status from public.orders where id = o) = 'awaiting_verification', 'admin delivery marked COD paid';
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'payable before courier remittance';
  perform public.admin_verify_cod(sh, 4750, current_date, 'TCS-REMIT-S8');
  assert (select payment_status from public.orders where id = o) = 'paid', 'courier COD verified but order not paid';
  assert (select status from public.seller_settlements where shipment_id = sh) = 'available', 'not payable after verify';
end $$;

-- (c) prepaid: only payable once the payment is verified AND delivered
do $$
declare
  o uuid := (select id from t_r where k = 'prepaid');
  sh uuid;
begin
  assert (select payment_status from public.orders where id = o) = 'awaiting_verification', 'easypaisa not awaiting verification';
  sh := public.admin_save_shipment(o, (select id from public.vendors where slug = 'anker-official'),
    (select id from public.couriers where code = 'tcs'), 'TCS-S8P', 'booked', 0, 250, 0);
  assert (select cod_settlement_status from public.shipments where id = sh) = 'not_applicable', 'prepaid has COD';
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'unverified prepaid is payable';
  perform public.admin_set_payment_status(o, 'paid', 'TID checked');
  assert (select status from public.seller_settlements where shipment_id = sh) = 'pending', 'prepaid payable before delivery';
  perform public.admin_save_shipment(o, (select id from public.vendors where slug = 'anker-official'),
    (select id from public.couriers where code = 'tcs'), 'TCS-S8P', 'delivered', 0, 250, 0);
  assert (select status from public.seller_settlements where shipment_id = sh) = 'available', 'verified + delivered prepaid not payable';
end $$;
reset role;

\echo 'ALL SETTLEMENT TESTS PASSED'
