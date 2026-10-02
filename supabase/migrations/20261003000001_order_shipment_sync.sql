-- =====================================================================
-- NEXORA — order ↔ shipment ↔ seller settlement synchronisation
--
-- 1. Rider orders: assigning a NEXORA rider books one "NEXORA Rider"
--    shipment per seller in the order (→ one pending seller settlement).
--    Idempotent: shipments are unique per (order, seller) and settlements
--    unique per shipment, so a settlement is created exactly once.
-- 2. Cancelling an order cancels its open shipments, which cancels the
--    open seller settlements. Orders with a delivered shipment cannot be
--    cancelled (mark the shipment Returned first), so an approved/paid
--    payout is never silently cancelled.
-- 3. Status sync:
--      rider picked up / on the way  → shipment In Transit
--      rider or admin delivered      → open shipments Delivered
--      courier shipment In Transit   → order On The Way (only from
--                                      Placed / Confirmed / Processing)
--      every active shipment Delivered → order Delivered
--    Delivering a COD order still only marks the cash "collected"
--    (awaiting_verification); it becomes paid only when an admin verifies
--    the COD (20261002000001_cod_payment_states.sql).
--
-- Only replaces functions and adds internal helpers. No tables, columns,
-- enums or RLS policies are created, changed or dropped.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal: book a NEXORA Rider shipment for every seller in the order
-- that doesn't have a shipment yet. Safe to call repeatedly.
-- ---------------------------------------------------------------------
create or replace function public._ensure_rider_shipments(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
  c public.couriers;
  parts int;
  r record;
  sid uuid;
begin
  select * into o from public.orders where id = p_order;
  if not found or o.status = 'cancelled' then return; end if;
  select * into c from public.couriers where code = 'nexora_rider';
  if not found then return; end if;

  select count(distinct vendor_id) into parts from public.order_items where order_id = o.id and vendor_id is not null;
  for r in
    select vendor_id, sum(line_total) as items_total
    from public.order_items where order_id = o.id and vendor_id is not null
    group by vendor_id
  loop
    sid := null;
    insert into public.shipments (order_id, order_number, vendor_id, courier_id, tracking_number, status,
      cod_amount, courier_charges, other_deductions, cod_settlement_status, notes)
    values (o.id, o.order_number, r.vendor_id, c.id, o.order_number, 'booked',
      -- cash the rider collects: whole order for one seller, else that seller's items
      case when o.payment_method <> 'cod' then 0 when parts = 1 then o.total else r.items_total end,
      c.default_charge, 0,
      case when o.payment_method = 'cod' then 'pending'::public.cod_settlement_status else 'not_applicable'::public.cod_settlement_status end,
      'Booked automatically for NEXORA rider delivery')
    on conflict (order_id, vendor_id) do nothing
    returning id into sid;
    if sid is not null then
      perform public._recompute_settlement(sid);
    end if;
  end loop;
end $$;
revoke execute on function public._ensure_rider_shipments(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Internal: move the order's open shipments to a status (order → shipment).
-- Never touches returned/cancelled shipments or moves one backwards.
-- ---------------------------------------------------------------------
create or replace function public._set_order_shipments_status(p_order uuid, p_status public.shipment_status)
returns void language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.shipments
    where order_id = p_order
      and status not in ('returned', 'cancelled', 'delivered')
      and not (p_status = 'in_transit' and status = 'in_transit')
  loop
    update public.shipments set
      status = p_status,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
    where id = r.id;
    perform public._recompute_settlement(r.id);
  end loop;
end $$;
revoke execute on function public._set_order_shipments_status(uuid, public.shipment_status) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Internal: mark an order delivered (shared by admin, rider and courier
-- sync). COD becomes COLLECTED, never paid.
-- ---------------------------------------------------------------------
create or replace function public._deliver_order(p_order uuid, p_note text, p_collected_by text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if o.payment_method = 'cod' and o.payment_status = 'pending' then
    update public.orders set payment_status = 'awaiting_verification' where id = o.id;
    update public.payments set status = 'awaiting_verification',
      meta = meta || jsonb_build_object('cod_collected_at', now(), 'collected_by', p_collected_by)
               || case when p_collected_by = 'rider' then jsonb_build_object('rider_id', auth.uid()) else '{}'::jsonb end
    where order_id = o.id;
  end if;
  perform public._set_order_status(o.id, 'delivered', p_note);
  perform public._set_order_shipments_status(o.id, 'delivered');
end $$;
revoke execute on function public._deliver_order(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Internal: cancel the order's open shipments (→ settlements cancelled).
-- Refuses when a shipment was already delivered.
-- ---------------------------------------------------------------------
create or replace function public._cancel_order_shipments(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if exists (select 1 from public.shipments where order_id = p_order and status = 'delivered') then
    raise exception 'A shipment of this order is already delivered — mark it Returned before cancelling' using errcode = 'P0001';
  end if;
  for r in select id from public.shipments where order_id = p_order and status in ('booked', 'in_transit') loop
    update public.shipments set status = 'cancelled' where id = r.id;
    perform public._recompute_settlement(r.id);
  end loop;
end $$;
revoke execute on function public._cancel_order_shipments(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Internal: shipment → order (courier shipments saved by an admin).
-- ---------------------------------------------------------------------
create or replace function public._sync_order_from_shipments(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
  active int;
  delivered int;
  moving int;
  sellers int;
  unshippable int;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.status in ('delivered', 'cancelled') then return; end if;
  select count(*) filter (where status not in ('returned', 'cancelled')),
         count(*) filter (where status = 'delivered'),
         count(*) filter (where status = 'in_transit')
    into active, delivered, moving
  from public.shipments where order_id = o.id;
  -- every seller's part must be delivered (items without a seller can't be shipped
  -- through a courier record, so those orders are delivered by an admin)
  select count(distinct vendor_id), count(*) filter (where vendor_id is null)
    into sellers, unshippable
  from public.order_items where order_id = o.id;

  if active > 0 and delivered = active and delivered = sellers and unshippable = 0 then
    perform public._deliver_order(o.id, 'Delivered by courier', 'courier');
  elsif (moving > 0 or delivered > 0) and o.status in ('placed', 'confirmed', 'processing') then
    perform public._set_order_status(o.id, 'on_the_way', 'Your order is on the way with our courier partner');
  end if;
end $$;
revoke execute on function public._sync_order_from_shipments(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Settlement amounts/status (as in 20261002000001) plus: any shipment of a
-- cancelled order is a cancelled settlement.
-- ---------------------------------------------------------------------
create or replace function public._recompute_settlement(p_shipment uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  s public.shipments;
  v public.vendors;
  cfg public.settlement_settings;
  o public.orders;
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
  select * into o from public.orders where id = s.order_id;
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
    when s.status in ('returned', 'cancelled') or o.status = 'cancelled' then 'cancelled'::public.seller_settlement_status
    when existing.status = 'on_hold' then 'on_hold'::public.seller_settlement_status
    when s.cod_settlement_status = 'verified' then 'available'::public.seller_settlement_status
    when s.cod_settlement_status = 'not_applicable' and s.status = 'delivered' and o.payment_status = 'paid'
      then 'available'::public.seller_settlement_status
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
-- Admin: assign rider (unchanged checks) + book rider shipments.
-- ---------------------------------------------------------------------
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
  perform public._ensure_rider_shipments(o.id);
  perform public.notify_user(p_rider, 'New delivery assigned', 'Order ' || o.order_number || ' — ' || o.area || ', ' || o.city, '/rider');
end $$;

-- ---------------------------------------------------------------------
-- Admin order status. Same rules as before; cancel also cancels open
-- shipments/settlements, delivered also delivers open shipments.
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
    perform public._cancel_order_shipments(o.id);
    perform public._restock_order(o.id);
    update public.orders set cancel_reason = coalesce(nullif(trim(p_note), ''), 'Cancelled by NEXORA') where id = o.id;
  end if;
  if p_status = 'delivered' then
    perform public._deliver_order(o.id, p_note, case when o.rider_id is not null then 'rider' else 'courier' end);
    return;
  end if;
  perform public._set_order_status(o.id, p_status, p_note);
  if p_status in ('picked_up', 'on_the_way') then
    perform public._set_order_shipments_status(o.id, 'in_transit');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Rider workflow (same steps and checks) + shipment sync.
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
    perform public._ensure_rider_shipments(o.id); -- orders assigned before this migration
    perform public._set_order_status(o.id, 'picked_up', 'Your order has been picked up by the rider');
    perform public._set_order_shipments_status(o.id, 'in_transit');
  elsif p_action = 'on_the_way' then
    if o.status <> 'picked_up' then raise exception 'Mark the order as picked up first' using errcode = 'P0001'; end if;
    perform public._set_order_status(o.id, 'on_the_way', 'Your rider is on the way');
    perform public._set_order_shipments_status(o.id, 'in_transit');
  elsif p_action = 'delivered' then
    if o.status <> 'on_the_way' then raise exception 'Order must be on the way first' using errcode = 'P0001'; end if;
    perform public._ensure_rider_shipments(o.id);
    -- cash is now with the rider; NEXORA marks it paid only after verifying the handover
    perform public._deliver_order(o.id, 'Delivered. Thank you for shopping with NEXORA!', 'rider');
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Customer cancel (same rules) + cancel open shipments/settlements.
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
  perform public._cancel_order_shipments(o.id);
  update public.orders set cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer') where id = o.id;
  perform public._restock_order(o.id);
  update public.payments set status = case when status = 'paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
  where order_id = o.id;
  update public.orders set payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
  where id = o.id;
  perform public._set_order_status(o.id, 'cancelled', 'Cancelled by customer');
end $$;

-- ---------------------------------------------------------------------
-- Admin shipment save (same checks as before) + no shipments on cancelled
-- orders + shipment → order sync.
-- ---------------------------------------------------------------------
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
  if o.status = 'cancelled' then
    raise exception 'This order is cancelled — shipments cannot be booked or changed' using errcode = 'P0001';
  end if;
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
  perform public._sync_order_from_shipments(p_order);
  return sid;
end $$;
