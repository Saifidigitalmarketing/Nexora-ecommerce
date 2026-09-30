import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/admin/FilterBar";
import { VerifyCodButton } from "@/components/admin/settlement/CodActions";
import { CouriersManager } from "@/components/admin/settlement/CouriersManager";
import { PayoutActions } from "@/components/admin/settlement/PayoutActions";
import { CommissionSettings, SellersTable, type SellerRow } from "@/components/admin/settlement/SettlementConfig";
import { AdminPage, Card, StatCard, Table, Td } from "@/components/admin/ui";
import { cn, formatDate, formatPKR } from "@/lib/format";
import {
  COD_STATUS_LABEL,
  SETTLEMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  settlementTone,
  trackingUrl,
  type Courier,
  type SellerSettlement,
  type Shipment,
} from "@/lib/settlement";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shipments & Settlements" };

const TABS = [
  { value: "cod", label: "COD settlement" },
  { value: "payouts", label: "Seller payouts" },
  { value: "history", label: "Settlement history" },
  { value: "couriers", label: "Couriers" },
  { value: "settings", label: "Commission & sellers" },
];

type ShipRow = Shipment & {
  order: { id: string; order_number: string; payment_method: string } | null;
  vendor: { name: string } | null;
  courier: Pick<Courier, "name" | "tracking_url_template"> | null;
};
type SettleRow = SellerSettlement & {
  order: { id: string; order_number: string } | null;
  vendor: { name: string } | null;
  shipment: { tracking_number: string | null; courier: { name: string } | null } | null;
};

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full font-label-sm text-label-sm whitespace-nowrap", tone)}>{children}</span>;
}

export default async function AdminSettlements({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; seller?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "cod";
  const q = sp.q?.replace(/[%,()*]/g, " ").trim();
  const supabase = await getSupabaseServer();

  const [{ data: allSettlements }, { data: vendors }] = await Promise.all([
    supabase.from("seller_settlements").select("status, seller_payable, commission_amount, paid_amount"),
    supabase.from("vendors").select("id, name, commission_type, commission_value, owner:profiles(email)").order("name"),
  ]);
  const sum = (rows: { [k: string]: unknown }[] | null, key: string, pred: (r: { status: string }) => boolean) =>
    (rows ?? []).filter((r) => pred(r as { status: string })).reduce((n, r) => n + Number(r[key] ?? 0), 0);
  const { count: codPending } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered")
    .in("cod_settlement_status", ["pending", "received", "disputed"]);

  let body: React.ReactNode = null;

  if (tab === "cod") {
    let req = supabase
      .from("shipments")
      .select("*, order:orders(id, order_number, payment_method), vendor:vendors(name), courier:couriers(name, tracking_url_template)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) req = req.ilike("tracking_number", `%${q}%`);
    if (sp.seller) req = req.eq("vendor_id", sp.seller);
    const { data } = await req;
    const rows = (data ?? []) as unknown as ShipRow[];
    body = (
      <Card>
        <Table head={["Order", "Seller", "Courier / tracking", "Shipment", "COD", "Courier charges", "Deductions", "COD settlement", "Received", ""]}>
          {rows.map((s) => {
            const link = trackingUrl(s.courier, s.tracking_number);
            return (
              <tr key={s.id} className="hover:bg-surface-container-low/50">
                <Td>
                  {s.order ? (
                    <Link href={`/admin/orders/${s.order.id}`} className="font-label-lg text-label-lg text-primary whitespace-nowrap">
                      {s.order.order_number}
                    </Link>
                  ) : "—"}
                </Td>
                <Td>{s.vendor?.name}</Td>
                <Td>
                  <p>{s.courier?.name ?? "—"}</p>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="font-body-sm text-body-sm text-primary">{s.tracking_number}</a>
                  ) : (
                    <p className="font-body-sm text-body-sm text-secondary">{s.tracking_number ?? "—"}</p>
                  )}
                </Td>
                <Td>
                  <p>{SHIPMENT_STATUS_LABEL[s.status]}</p>
                  {s.delivered_at ? <p className="font-body-sm text-body-sm text-secondary">{formatDate(s.delivered_at)}</p> : null}
                </Td>
                <Td className="tabular whitespace-nowrap">{formatPKR(s.cod_amount)}</Td>
                <Td className="tabular whitespace-nowrap">{formatPKR(s.courier_charges)}</Td>
                <Td className="tabular whitespace-nowrap">{formatPKR(s.other_deductions)}</Td>
                <Td>
                  <Chip tone={settlementTone(s.cod_settlement_status)}>{COD_STATUS_LABEL[s.cod_settlement_status]}</Chip>
                  {s.cod_settlement_reference ? <p className="font-body-sm text-body-sm text-secondary mt-0.5">Ref {s.cod_settlement_reference}</p> : null}
                </Td>
                <Td className="tabular whitespace-nowrap">
                  {s.cod_received_amount != null ? formatPKR(s.cod_received_amount) : "—"}
                  {s.cod_settlement_date ? <p className="font-body-sm text-body-sm text-secondary">{formatDate(s.cod_settlement_date)}</p> : null}
                </Td>
                <Td>
                  {s.status === "delivered" && s.cod_settlement_status !== "not_applicable" ? (
                    <VerifyCodButton
                      shipmentId={s.id}
                      codAmount={Number(s.cod_amount)}
                      deductions={Number(s.courier_charges) + Number(s.other_deductions)}
                      current={{ received: s.cod_received_amount, date: s.cod_settlement_date, reference: s.cod_settlement_reference, status: s.cod_settlement_status }}
                    />
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
        {!rows.length ? (
          <p className="font-body-md text-body-md text-secondary py-6 text-center">No shipments yet. Book one from an order&apos;s page (Admin → Orders → order → Courier &amp; COD).</p>
        ) : null}
      </Card>
    );
  } else if (tab === "payouts" || tab === "history") {
    let req = supabase
      .from("seller_settlements")
      .select("*, order:orders(id, order_number), vendor:vendors(name), shipment:shipments(tracking_number, courier:couriers(name))")
      .order(tab === "history" ? "paid_at" : "created_at", { ascending: false })
      .limit(300);
    req = tab === "history" ? req.eq("status", "paid") : req.in("status", ["pending", "available", "approved", "on_hold"]);
    if (sp.seller) req = req.eq("vendor_id", sp.seller);
    const { data } = await req;
    let rows = (data ?? []) as unknown as SettleRow[];
    if (q) rows = rows.filter((r) => r.order?.order_number.toLowerCase().includes(q.toLowerCase()) || r.shipment?.tracking_number?.toLowerCase().includes(q.toLowerCase()) || r.payment_reference?.toLowerCase().includes(q.toLowerCase()));
    body = (
      <Card>
        <Table head={["Order", "Seller", "Courier / tracking", "Seller sales", "Courier deductions", "NEXORA commission", "Seller payable", "Status", tab === "history" ? "Paid on / reference" : ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface-container-low/50">
              <Td>
                {r.order ? (
                  <Link href={`/admin/orders/${r.order.id}`} className="font-label-lg text-label-lg text-primary whitespace-nowrap">
                    {r.order.order_number}
                  </Link>
                ) : "—"}
              </Td>
              <Td>{r.vendor?.name}</Td>
              <Td>
                <p>{r.shipment?.courier?.name ?? "—"}</p>
                <p className="font-body-sm text-body-sm text-secondary">{r.shipment?.tracking_number ?? ""}</p>
              </Td>
              <Td className="tabular whitespace-nowrap">{formatPKR(r.gross_sales)}</Td>
              <Td className="tabular whitespace-nowrap">- {formatPKR(r.courier_deductions)}</Td>
              <Td className="tabular whitespace-nowrap">
                - {formatPKR(r.commission_amount)}
                <p className="font-body-sm text-body-sm text-secondary">{r.commission_type === "percent" ? `${Number(r.commission_rate)}%` : "fixed"}</p>
              </Td>
              <Td className="tabular whitespace-nowrap font-semibold">{formatPKR(r.seller_payable)}</Td>
              <Td>
                <Chip tone={settlementTone(r.status)}>{SETTLEMENT_STATUS_LABEL[r.status]}</Chip>
              </Td>
              <Td>
                {tab === "history" ? (
                  <div className="whitespace-nowrap">
                    <p>{r.paid_at ? formatDate(r.paid_at) : "—"}</p>
                    <p className="font-body-sm text-body-sm text-secondary">Ref {r.payment_reference}</p>
                  </div>
                ) : (
                  <PayoutActions id={r.id} status={r.status} payable={Number(r.seller_payable)} seller={r.vendor?.name ?? "seller"} />
                )}
              </Td>
            </tr>
          ))}
        </Table>
        {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">{tab === "history" ? "No payouts yet." : "Nothing to settle right now."}</p> : null}
        {tab === "payouts" ? (
          <p className="font-body-sm text-body-sm text-secondary pt-3">
            Pending = COD not yet verified · Available = COD verified, ready to approve · Approved = ready to pay.
          </p>
        ) : null}
      </Card>
    );
  } else if (tab === "couriers") {
    const { data } = await supabase.from("couriers").select("*").order("name");
    body = (
      <Card title="Couriers" actions={<span className="font-body-sm text-body-sm text-secondary">Charges are defaults — each shipment can be adjusted</span>}>
        <CouriersManager rows={(data ?? []) as Courier[]} />
      </Card>
    );
  } else {
    const { data: cfg } = await supabase.from("settlement_settings").select("*").eq("id", 1).maybeSingle();
    const sellerRows: SellerRow[] = ((vendors ?? []) as unknown as { id: string; name: string; commission_type: "percent" | "fixed" | null; commission_value: number | null; owner: { email: string | null } | null }[]).map((v) => ({
      id: v.id,
      name: v.name,
      commission_type: v.commission_type,
      commission_value: v.commission_value,
      owner_email: v.owner?.email ?? null,
    }));
    body = (
      <>
        <Card title="Default commission">
          <CommissionSettings type={cfg?.default_commission_type ?? "percent"} value={Number(cfg?.default_commission_value ?? 0)} />
          <p className="font-body-sm text-body-sm text-secondary mt-2">
            Changes recalculate pending and available settlements. Approved and paid settlements keep the amounts they were approved with.
          </p>
        </Card>
        <Card title="Sellers">
          <SellersTable rows={sellerRows} />
          <p className="font-body-sm text-body-sm text-secondary mt-2">
            Linking an account gives that seller read-only access to their store&apos;s finances at <code>/seller</code>. The seller must sign up first.
          </p>
        </Card>
      </>
    );
  }

  const settlements = (allSettlements ?? []) as { [k: string]: unknown }[];
  return (
    <AdminPage title="Shipments & Settlements" subtitle="Customer pays COD to the courier → courier remits to NEXORA → admin verifies → commission and courier deductions → seller is paid.">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-space-sm">
        <StatCard icon="local_shipping" label="COD to verify" value={codPending ?? 0} hint="Delivered, not yet verified" href="/admin/settlements?tab=cod" />
        <StatCard icon="hourglass_top" label="Seller pending" value={formatPKR(sum(settlements, "seller_payable", (r) => r.status === "pending" || r.status === "on_hold"))} />
        <StatCard icon="account_balance_wallet" label="Ready to pay" value={formatPKR(sum(settlements, "seller_payable", (r) => r.status === "available" || r.status === "approved"))} href="/admin/settlements?tab=payouts" />
        <StatCard icon="percent" label="NEXORA commission" value={formatPKR(sum(settlements, "commission_amount", (r) => r.status !== "cancelled"))} />
        <StatCard icon="paid" label="Paid to sellers" value={formatPKR(sum(settlements, "paid_amount", (r) => r.status === "paid"))} href="/admin/settlements?tab=history" />
      </div>
      <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/settlements?tab=${t.value}`}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap",
              tab === t.value ? "bg-on-surface text-surface" : "bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-low",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {["cod", "payouts", "history"].includes(tab) ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <Link href={`/admin/settlements?tab=${tab}`} className={cn("shrink-0 px-3 py-1 rounded-full font-label-sm text-label-sm", !sp.seller ? "bg-primary/10 text-primary" : "bg-surface-container-lowest shadow-sm")}>
              All sellers
            </Link>
            {(vendors ?? []).map((v) => (
              <Link
                key={v.id}
                href={`/admin/settlements?tab=${tab}&seller=${v.id}`}
                className={cn("shrink-0 px-3 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap", sp.seller === v.id ? "bg-primary/10 text-primary" : "bg-surface-container-lowest shadow-sm")}
              >
                {v.name}
              </Link>
            ))}
          </div>
          <Suspense>
            <FilterBar placeholder={tab === "cod" ? "Tracking number" : "Order no., tracking or reference"} />
          </Suspense>
        </div>
      ) : null}
      {body}
    </AdminPage>
  );
}
