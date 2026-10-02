-- =====================================================================
-- NEXORA — COD payment states fix
--
-- Rule: "Delivered" does NOT mean "COD money received by NEXORA".
--
--   COD Pending                  order not delivered yet       payment_status = pending
--   COD Collected /
--   Courier Settlement Pending   delivered, cash is with the   payment_status = awaiting_verification
--                                rider / courier               shipment cod_settlement_status = pending
--   Received (unverified)        courier says it remitted      cod_settlement_status = received
--   COD Received by NEXORA       admin verified the money      cod_settlement_status = verified,
--                                                              payment_status = paid
--   Seller Payable               seller_settlements.status = available
--   Seller Payout Pending        seller_settlements.status = approved
--   Seller Paid                  seller_settlements.status = paid
--
-- Only replaces functions (create or replace) and adds one courier row.
-- No tables, columns, enums or RLS policies are created, changed or dropped.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal: the order's COD payment is "received by NEXORA" (paid) only
-- while every COD shipment of the order is verified; if a verification is
-- withdrawn (received / disputed) it goes back to "collected".
-- Never called on delivery.
-- ---------------------------------------------------------------------
create or replace function public._sync_cod_payment(p_order uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
  all_verified boolean;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.payment_method <> 'cod' or o.payment_status in ('failed', 'refunded') then return; end if;
  all_verified := exists (select 1 from public.shipments where order_id = o.id and status <> 'cancelled')
    and not exists (select 1 from public.shipments
                    where order_id = o.id and status <> 'cancelled' and cod_settlement_status <> 'verified');
  if all_verified and o.payment_status <> 'paid' then
    update public.orders set payment_status = 'paid' where id = o.id;
    update public.payments set status = 'paid', verified_by = auth.uid(), verified_at = now(),
      meta = meta || '{"cod_received_by": "nexora"}'::jsonb
    where order_id = o.id;
  elsif not all_verified and o.payment_status = 'paid' and o.status = 'delivered' then
    update public.orders set payment_status = 'awaiting_verification' where id = o.id;
    update public.payments set status = 'awaiting_verification', verified_by = null, verified_at = null
    where order_id = o.id;
  end if;
end $$;
revoke execute on function public._sync_cod_payment(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Settlement amounts/status. Changes from the previous version:
--   * prepaid orders are only "available" once the payment is verified
--     (orders.payment_status = paid) AND the shipment is delivered.
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
    when s.status in ('returned', 'cancelled') then 'cancelled'::public.seller_settlement_status
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
-- Admin order status: delivering a COD order marks the cash as
-- COLLECTED (awaiting NEXORA verification), not paid.
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
  if p_status = 'delivered' and o.payment_method = 'cod' and o.payment_status = 'pending' then
    update public.orders set payment_status = 'awaiting_verification' where id = o.id;
    update public.payments set status = 'awaiting_verification',
      meta = meta || jsonb_build_object('cod_collected_at', now(), 'collected_by', 'courier')
    where order_id = o.id;
  end if;
  perform public._set_order_status(o.id, p_status, p_note);
end $$;

-- ---------------------------------------------------------------------
-- Rider workflow (unchanged except the COD step on delivery).
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
    if o.payment_method = 'cod' and o.payment_status = 'pending' then
      -- cash is now with the rider; NEXORA marks it paid only after verifying the handover
      update public.orders set payment_status = 'awaiting_verification' where id = o.id;
      update public.payments set status = 'awaiting_verification',
        meta = meta || jsonb_build_object('cod_collected_at', now(), 'collected_by', 'rider', 'rider_id', auth.uid())
      where order_id = o.id;
    end if;
    perform public._set_order_status(o.id, 'delivered', 'Delivered. Thank you for shopping with NEXORA!');
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin payment verification (prepaid methods): also refresh the seller
-- settlements so a verified prepaid order can become payable.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_payment_status(p_order uuid, p_status public.payment_status, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  update public.orders set payment_status = p_status where id = p_order;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  update public.payments set status = p_status, verified_by = auth.uid(), verified_at = now(),
    meta = meta || jsonb_build_object('note', p_note)
  where order_id = p_order;
  for r in select id from public.shipments where order_id = p_order loop
    perform public._recompute_settlement(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- COD verification. Changes from the previous version:
--   * locked once the seller settlement is approved or paid;
--   * when every COD shipment of the order is verified, the order's
--     payment becomes paid (COD received by NEXORA).
-- ---------------------------------------------------------------------
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
  if exists (select 1 from public.seller_settlements where shipment_id = s.id and status in ('approved', 'paid')) then
    raise exception 'Seller settlement is already approved — COD record is locked' using errcode = 'P0001';
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
  perform public._sync_cod_payment(s.order_id);
end $$;

revoke execute on function public.admin_verify_cod(uuid, numeric, date, text, public.cod_settlement_status) from public, anon;
grant execute on function public.admin_verify_cod(uuid, numeric, date, text, public.cod_settlement_status) to authenticated;

-- ---------------------------------------------------------------------
-- NEXORA's own riders as a "courier", so rider-delivered COD goes through
-- the same handover → verify → seller payable → payout steps.
-- ---------------------------------------------------------------------
insert into public.couriers (name, code, default_charge, tracking_url_template)
values ('NEXORA Rider', 'nexora_rider', 0, null)
on conflict (code) do nothing;
