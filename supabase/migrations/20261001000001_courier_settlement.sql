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
