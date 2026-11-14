-- NEXORA: reconcile per-seller COD allocations and freeze financially settled shipments.
-- Allocation policy:
--   * seller weight = sum(order_items.line_total) for that vendor;
--   * order discount and delivery charge are each allocated independently
--     in proportion to seller weight;
--   * each component is allocated in integer paisa using the largest-remainder
--     method (fraction descending, vendor UUID ascending as deterministic tie-break);
--   * seller COD = seller gross - allocated discount + allocated delivery.
-- This guarantees that seller COD amounts sum exactly to orders.total, including
-- rounding cases. Zero-subtotal orders split each component equally by seller.

create or replace function public._allocated_order_component(
  p_order uuid,
  p_vendor uuid,
  p_amount numeric
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with seller_weights as (
    select vendor_id, sum(line_total)::numeric as weight
    from public.order_items
    where order_id = p_order and vendor_id is not null
    group by vendor_id
  ),
  totals as (
    select count(*)::numeric as seller_count, coalesce(sum(weight), 0)::numeric as total_weight
    from seller_weights
  ),
  raw_shares as (
    select w.vendor_id,
      (round(coalesce(p_amount, 0) * 100)::numeric
        * case when t.total_weight > 0 then w.weight / t.total_weight
               else 1 / nullif(t.seller_count, 0) end) as raw_paisa
    from seller_weights w cross join totals t
  ),
  ranked as (
    select vendor_id,
      floor(raw_paisa) as base_paisa,
      raw_paisa - floor(raw_paisa) as fractional_paisa,
      row_number() over (order by raw_paisa - floor(raw_paisa) desc, vendor_id) as remainder_rank,
      round(coalesce(p_amount, 0) * 100)
        - sum(floor(raw_paisa)) over () as remaining_paisa
    from raw_shares
  )
  select coalesce((base_paisa + case when remainder_rank <= remaining_paisa then 1 else 0 end) / 100, 0)
  from ranked
  where vendor_id = p_vendor;
$$;
revoke all on function public._allocated_order_component(uuid, uuid, numeric) from public, anon, authenticated;

create or replace function public._seller_cod_allocation(p_order uuid, p_vendor uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(oi.line_total), 0)
    - public._allocated_order_component(p_order, p_vendor, o.discount_total)
    + public._allocated_order_component(p_order, p_vendor, o.delivery_charge)
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id and oi.vendor_id = p_vendor
  where o.id = p_order
  group by o.discount_total, o.delivery_charge;
$$;
revoke all on function public._seller_cod_allocation(uuid, uuid) from public, anon, authenticated;

create or replace function public._ensure_rider_shipments(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  c public.couriers;
  parts integer;
  r record;
  sid uuid;
  seller_cod numeric(12,2);
  allocated_total numeric(12,2) := 0;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.status = 'cancelled' then return; end if;

  select * into c from public.couriers where code = 'nexora_rider';
  if not found then return; end if;

  if o.payment_method = 'cod' and exists (
    select 1 from public.order_items where order_id = o.id and vendor_id is null
  ) then
    raise exception 'Cannot allocate COD: one or more order items have no seller' using errcode = 'P0001';
  end if;

  select count(distinct vendor_id) into parts
  from public.order_items where order_id = o.id and vendor_id is not null;
  if parts = 0 then
    if o.payment_method = 'cod' and o.total <> 0 then
      raise exception 'Cannot allocate COD: order has no seller shipments' using errcode = 'P0001';
    end if;
    return;
  end if;

  for r in
    select vendor_id, sum(line_total)::numeric(12,2) as items_total
    from public.order_items
    where order_id = o.id and vendor_id is not null
    group by vendor_id
    order by vendor_id
  loop
    if o.payment_method = 'cod' then
       seller_cod := public._seller_cod_allocation(o.id, r.vendor_id);
      if seller_cod < 0 then
        raise exception 'Invalid COD allocation for seller %', r.vendor_id using errcode = 'P0001';
      end if;
      allocated_total := allocated_total + seller_cod;
    else
      seller_cod := 0;
    end if;

    sid := null;
    insert into public.shipments (
      order_id, order_number, vendor_id, courier_id, tracking_number, status,
      cod_amount, courier_charges, other_deductions, cod_settlement_status, notes
    )
    values (
      o.id, o.order_number, r.vendor_id, c.id, o.order_number, 'booked',
      seller_cod, c.default_charge, 0,
      case when o.payment_method = 'cod' then 'pending'::public.cod_settlement_status
           else 'not_applicable'::public.cod_settlement_status end,
      'Booked automatically for NEXORA rider delivery'
    )
    on conflict (order_id, vendor_id) do nothing
    returning id into sid;

    if sid is not null then
      perform public._recompute_settlement(sid);
    end if;
  end loop;

  if o.payment_method = 'cod' then
    select coalesce(sum(cod_amount), 0) into allocated_total
    from public.shipments
    where order_id = o.id and status not in ('cancelled', 'returned');
    if allocated_total <> o.total then
      raise exception 'COD allocation mismatch: active seller shipments total %, order total %',
        allocated_total, o.total using errcode = 'P0001';
    end if;
  end if;
end $$;
revoke execute on function public._ensure_rider_shipments(uuid) from public, anon, authenticated;

-- Available means the COD has been verified and the seller payable is now a
-- financial record. Never silently recalculate it; only pending/on-hold
-- settlements may be recomputed. Approved and paid were already frozen.
create or replace function public._recompute_settlement(p_shipment uuid)
returns void
language plpgsql
security definer
set search_path = public
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
  select * into s from public.shipments where id = p_shipment for update;
  if not found then return; end if;
  select * into v from public.vendors where id = s.vendor_id;
  select * into cfg from public.settlement_settings where id = 1;
  select * into o from public.orders where id = s.order_id;
  select * into existing from public.seller_settlements where shipment_id = s.id for update;

  if found and existing.status in ('available', 'approved', 'paid', 'on_hold') then
    return;
  end if;

  select coalesce(sum(line_total), 0) into gross
  from public.order_items where order_id = s.order_id and vendor_id = s.vendor_id;

  ctype := coalesce(v.commission_type, cfg.default_commission_type, 'percent');
  cval := coalesce(v.commission_value, cfg.default_commission_value, 0);
  comm := case when ctype = 'percent' then round(gross * cval / 100, 2) else least(cval, gross) end;
  ded := s.courier_charges + s.other_deductions;

  next_status := case
    when s.status in ('returned', 'cancelled') or o.status = 'cancelled'
      then 'cancelled'::public.seller_settlement_status
    when existing.status = 'on_hold' then 'on_hold'::public.seller_settlement_status
    when s.cod_settlement_status = 'verified' then 'available'::public.seller_settlement_status
    when s.cod_settlement_status = 'not_applicable' and s.status = 'delivered' and o.payment_status = 'paid'
      then 'available'::public.seller_settlement_status
    else 'pending'::public.seller_settlement_status
  end;

  insert into public.seller_settlements (
    shipment_id, order_id, vendor_id, gross_sales, courier_deductions,
    commission_type, commission_rate, commission_amount, seller_payable, status
  )
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

-- Append-only audit trail for the one supported correction: reopening a COD
-- verification before seller approval/payment. Paid/approved payouts need a
-- separate accounting adjustment process and cannot be reversed here.
create table if not exists public.shipment_correction_audit (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id),
  transaction_id bigint not null,
  action text not null check (action = 'reopen_cod_verification'),
  reason text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
revoke all on public.shipment_correction_audit from public, anon, authenticated;
alter table public.shipment_correction_audit enable row level security;
grant select on public.shipment_correction_audit to authenticated;
drop policy if exists shipment_correction_audit_admin_read on public.shipment_correction_audit;
create policy shipment_correction_audit_admin_read
  on public.shipment_correction_audit for select to authenticated
  using (public.is_admin());

-- Database-level guard: no UPDATE/DELETE of a verified shipment or a shipment
-- whose seller settlement has become available/approved/paid. This applies to
-- direct SQL and every RPC, not just the admin UI.
create or replace function public.guard_financially_locked_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settlement_state public.seller_settlement_status;
  locked boolean;
begin
  select status into settlement_state
  from public.seller_settlements
  where shipment_id = old.id;

  locked := old.cod_settlement_status = 'verified'
    or settlement_state in ('available', 'approved', 'paid')
    or exists (select 1 from public.shipment_correction_audit a where a.shipment_id = old.id);

  if locked then
    if tg_op = 'UPDATE'
      and new.status is not distinct from old.status
      and new.courier_id is not distinct from old.courier_id
      and new.tracking_number is not distinct from old.tracking_number
      and new.cod_amount is not distinct from old.cod_amount
      and new.courier_charges is not distinct from old.courier_charges
      and new.other_deductions is not distinct from old.other_deductions
      and new.delivered_at is not distinct from old.delivered_at
      and exists (
        select 1 from public.shipment_correction_audit a
        where a.shipment_id = old.id
          and a.transaction_id = txid_current()
          and a.changed_by = auth.uid()
          and a.action = 'reopen_cod_verification'
      ) and (
        (old.cod_settlement_status = 'verified'
          and new.cod_settlement_status = 'disputed'
          and new.cod_received_amount is not distinct from old.cod_received_amount
          and new.cod_settlement_reference is not distinct from old.cod_settlement_reference
          and new.cod_verified_by is null
          and new.cod_verified_at is null)
        or
        (old.cod_settlement_status in ('disputed', 'received')
          and new.cod_settlement_status in ('received', 'verified'))
      ) then
      return new;
    end if;
    raise exception 'Shipment is financially locked after COD verification or seller payable creation; use an audited correction workflow'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists shipments_financial_lock on public.shipments;
create trigger shipments_financial_lock
before update or delete on public.shipments
for each row execute function public.guard_financially_locked_shipment();

-- Settlement ledger values are immutable once available. The normal lifecycle
-- (available -> approved -> paid, or available -> on_hold) remains supported.
create or replace function public.guard_finalized_seller_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.status in ('available', 'approved', 'paid', 'on_hold') then
    raise exception 'Available/finalized seller settlements cannot be deleted' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if old.status = 'paid' then
    raise exception 'Paid seller settlements are immutable' using errcode = 'P0001';
  end if;

  if old.status in ('available', 'approved', 'on_hold') then
    if new.shipment_id is distinct from old.shipment_id
      or new.order_id is distinct from old.order_id
      or new.vendor_id is distinct from old.vendor_id
      or new.gross_sales is distinct from old.gross_sales
      or new.courier_deductions is distinct from old.courier_deductions
      or new.commission_type is distinct from old.commission_type
      or new.commission_rate is distinct from old.commission_rate
      or new.commission_amount is distinct from old.commission_amount
      or new.seller_payable is distinct from old.seller_payable then
      raise exception 'Available/finalized seller settlement amounts are locked' using errcode = 'P0001';
    end if;
    if old.status = 'approved' and new.status not in ('approved', 'paid', 'on_hold') then
      raise exception 'Approved settlement cannot be reversed without an audited correction workflow' using errcode = 'P0001';
    end if;
    if old.status = 'on_hold' and new.status not in ('on_hold', 'pending') then
      raise exception 'On-hold settlement can only remain on hold or be released for recomputation' using errcode = 'P0001';
    end if;
    if old.status = 'available' and new.status not in ('available', 'approved', 'on_hold') then
      if not (new.status = 'pending' and exists (
        select 1 from public.shipment_correction_audit a
        where a.shipment_id = old.shipment_id
          and a.transaction_id = txid_current()
          and a.changed_by = auth.uid()
          and a.action = 'reopen_cod_verification'
      )) then
        raise exception 'Available settlement can only be approved or placed on hold; use an audited COD correction'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists seller_settlements_financial_lock on public.seller_settlements;
create trigger seller_settlements_financial_lock
before update or delete on public.seller_settlements
for each row execute function public.guard_finalized_seller_settlement();

-- Preserve the existing admin workflow for unverified shipments. A verified,
-- available, approved or paid shipment cannot be edited via this RPC.
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  sid uuid;
  cur public.shipments;
  settlement_state public.seller_settlement_status;
  expected_cod numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status = 'cancelled' then
    raise exception 'This order is cancelled — shipments cannot be booked or changed' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.order_items where order_id = p_order and vendor_id = p_vendor
  ) then
    raise exception 'This seller has no items in the order' using errcode = '22023';
  end if;
  if coalesce(p_cod_amount, 0) < 0
    or coalesce(p_courier_charges, 0) < 0
    or coalesce(p_other_deductions, 0) < 0 then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;

  select * into cur from public.shipments
  where order_id = p_order and vendor_id = p_vendor
  for update;
  if found then
    select status into settlement_state
    from public.seller_settlements where shipment_id = cur.id;

    if cur.cod_settlement_status = 'verified'
      or settlement_state in ('available', 'approved', 'paid')
      or exists (select 1 from public.shipment_correction_audit a where a.shipment_id = cur.id) then
      raise exception 'Shipment is financially locked after COD verification or seller payable creation'
        using errcode = 'P0001';
    end if;
  end if;

  if o.payment_method = 'cod' then
    if exists (select 1 from public.order_items where order_id = p_order and vendor_id is null) then
      raise exception 'Cannot allocate COD: one or more order items have no seller' using errcode = 'P0001';
    end if;
    expected_cod := public._seller_cod_allocation(p_order, p_vendor);
    if round(coalesce(p_cod_amount, 0), 2) is distinct from expected_cod then
      raise exception 'COD amount for this seller must be Rs. % (allocated from order total)', expected_cod
        using errcode = '22023';
    end if;
  elsif coalesce(p_cod_amount, 0) <> 0 then
    raise exception 'Prepaid shipments must have zero COD amount' using errcode = '22023';
  end if;

  insert into public.shipments (
    order_id, order_number, vendor_id, courier_id, tracking_number, status,
    cod_amount, courier_charges, other_deductions, delivered_at, notes, cod_settlement_status
  )
  values (
    p_order, o.order_number, p_vendor, p_courier, nullif(trim(p_tracking), ''),
    p_status, coalesce(p_cod_amount, 0), coalesce(p_courier_charges, 0),
    coalesce(p_other_deductions, 0),
    case when p_status = 'delivered' then coalesce(p_delivered_at, now()) else p_delivered_at end,
    nullif(trim(p_notes), ''),
    case when o.payment_method = 'cod' then 'pending'::public.cod_settlement_status
         else 'not_applicable'::public.cod_settlement_status end
  )
  on conflict (order_id, vendor_id) do update set
    courier_id = excluded.courier_id,
    tracking_number = excluded.tracking_number,
    status = excluded.status,
    cod_amount = excluded.cod_amount,
    courier_charges = excluded.courier_charges,
    other_deductions = excluded.other_deductions,
    delivered_at = case when excluded.status = 'delivered'
      then coalesce(excluded.delivered_at, shipments.delivered_at, now())
      else excluded.delivered_at end,
    notes = excluded.notes
  returning id into sid;

  perform public._recompute_settlement(sid);
  perform public._sync_order_from_shipments(p_order);
  return sid;
end $$;


-- Audited COD correction: reopen a verified receipt only while the related
-- seller settlement is Available (never Approved/Paid). The shipment stays
-- delivered; only the COD verification is changed to Disputed. This reverses
-- the order's paid state and the seller payable, and records before/after data.
create or replace function public.admin_reopen_cod_verification(
  p_shipment uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shipments;
  st public.seller_settlements;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A correction reason is required' using errcode = '22023';
  end if;

  select * into s from public.shipments where id = p_shipment for update;
  if not found then raise exception 'Shipment not found' using errcode = 'P0002'; end if;
  select * into st from public.seller_settlements where shipment_id = s.id for update;
  if not found or st.status <> 'available' then
    raise exception 'Only an Available seller settlement can have COD verification reopened; Approved/Paid settlements are immutable'
      using errcode = 'P0001';
  end if;
  if s.cod_settlement_status <> 'verified' then
    raise exception 'Only a verified COD shipment can be corrected' using errcode = 'P0001';
  end if;

  insert into public.shipment_correction_audit (
    shipment_id, transaction_id, action, reason, before_state, after_state, changed_by
  )
  values (
    s.id, txid_current(), 'reopen_cod_verification', trim(p_reason),
    jsonb_build_object(
      'cod_settlement_status', s.cod_settlement_status,
      'cod_received_amount', s.cod_received_amount,
      'cod_settlement_reference', s.cod_settlement_reference,
      'cod_verified_by', s.cod_verified_by,
      'cod_verified_at', s.cod_verified_at,
      'seller_settlement_status', st.status,
      'seller_payable', st.seller_payable
    ),
    jsonb_build_object(
      'cod_settlement_status', 'disputed',
      'seller_settlement_status', 'pending'
    ),
    auth.uid()
  );

  update public.shipments
  set cod_settlement_status = 'disputed',
      cod_verified_by = null,
      cod_verified_at = null
  where id = s.id;

  update public.seller_settlements
  set status = 'pending',
      approved_by = null,
      approved_at = null,
      notes = concat_ws(E'\\n', nullif(notes, ''), 'COD verification reopened: ' || trim(p_reason))
  where id = st.id;

  perform public._recompute_settlement(s.id);
  perform public._sync_cod_payment(s.order_id);
end $$;
revoke execute on function public.admin_reopen_cod_verification(uuid, text) from public, anon;
grant execute on function public.admin_reopen_cod_verification(uuid, text) to authenticated;
