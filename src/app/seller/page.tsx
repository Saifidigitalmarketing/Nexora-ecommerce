import Link from "next/link";
import { StatCard, Table, Td } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate, formatPKR } from "@/lib/format";
import {
  codStageLabel,
  SETTLEMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  settlementTone,
  type CodSettlementStatus,
  type SellerSettlement,
  type SellerSummary,
  type ShipmentStatus,
} from "@/lib/settlement";
import { getSession, getSupabaseServer } from "@/lib/supabase/server";

type Row = SellerSettlement & {
  shipment: { order_number: string | null; tracking_number: string | null; status: ShipmentStatus; cod_settlement_status: CodSettlementStatus; delivered_at: string | null; courier: { name: string } | null } | null;
};

/** Seller finance dashboard — everything here is read-only. */
export default async function SellerHome({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const sp = await searchParams;
  const { userId } = await getSession();
  const supabase = await getSupabaseServer();
  const { data: stores } = await supabase.from("vendors").select("id, name").eq("owner_id", userId!).order("name");
  if (!stores?.length) {
    return <EmptyState icon="storefront" title="No store linked yet" description="Ask the NEXORA team to link your account to your store." />;
  }
  const store = stores.find((s) => s.id === sp.store) ?? stores[0];

  const [{ data: summary }, { data }] = await Promise.all([
    supabase.rpc("seller_balance_summary", { p_vendor: store.id }),
    supabase
      .from("seller_settlements")
      .select("*, shipment:shipments(order_number, tracking_number, status, cod_settlement_status, delivered_at, courier:couriers(name))")
      .eq("vendor_id", store.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const s = (summary ?? {}) as Partial<SellerSummary>;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{store.name}</h1>
          <p className="font-body-md text-body-md text-secondary">Your sales, balances and payouts from NEXORA.</p>
        </div>
        {stores.length > 1 ? (
          <div className="flex gap-1">
            {stores.map((st) => (
              <Link key={st.id} href={`/seller?store=${st.id}`} className={cn("px-3 py-1.5 rounded-full font-label-md text-label-md", st.id === store.id ? "bg-on-surface text-surface" : "bg-surface-container-lowest shadow-sm")}>
                {st.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">
        <StatCard icon="trending_up" label="Total sales" value={formatPKR(s.total_sales)} />
        <StatCard icon="hourglass_top" label="Pending balance" value={formatPKR(s.pending_balance)} hint="Waiting for courier COD" />
        <StatCard icon="account_balance_wallet" label="Available balance" value={formatPKR(s.available_balance)} hint="COD verified, payout due" />
        <StatCard icon="paid" label="Total paid" value={formatPKR(s.total_paid)} />
        <StatCard icon="percent" label="NEXORA commission" value={formatPKR(s.commission)} />
        <StatCard icon="local_shipping" label="Courier deductions" value={formatPKR(s.courier_deductions)} />
      </div>

      <section className="min-w-0 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high/60 p-space-md">
        <h2 className="font-label-lg text-label-lg font-bold mb-2">Settlement history</h2>
        {rows.length ? (
          <Table head={["Order", "Courier / tracking", "Shipment", "COD", "Sales", "Courier", "Commission", "Payable", "Status", "Paid / reference"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="font-label-lg text-label-lg whitespace-nowrap">{r.shipment?.order_number ?? "—"}</Td>
                <Td>
                  <p>{r.shipment?.courier?.name ?? "—"}</p>
                  <p className="font-body-sm text-body-sm text-secondary">{r.shipment?.tracking_number ?? ""}</p>
                </Td>
                <Td>
                  <p>{r.shipment ? SHIPMENT_STATUS_LABEL[r.shipment.status] : "—"}</p>
                  {r.shipment?.delivered_at ? <p className="font-body-sm text-body-sm text-secondary">{formatDate(r.shipment.delivered_at)}</p> : null}
                </Td>
                <Td className="whitespace-nowrap">{r.shipment ? codStageLabel(r.shipment) : "—"}</Td>
                <Td className="tabular whitespace-nowrap">{formatPKR(r.gross_sales)}</Td>
                <Td className="tabular whitespace-nowrap">- {formatPKR(r.courier_deductions)}</Td>
                <Td className="tabular whitespace-nowrap">
                  - {formatPKR(r.commission_amount)}
                  <p className="font-body-sm text-body-sm text-secondary">{r.commission_type === "percent" ? `${Number(r.commission_rate)}%` : "fixed"}</p>
                </Td>
                <Td className="tabular whitespace-nowrap font-semibold">{formatPKR(r.seller_payable)}</Td>
                <Td>
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full font-label-sm text-label-sm whitespace-nowrap", settlementTone(r.status))}>{SETTLEMENT_STATUS_LABEL[r.status]}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {r.status === "paid" ? (
                    <>
                      <p>{r.paid_at ? formatDate(r.paid_at) : ""}</p>
                      <p className="font-body-sm text-body-sm text-secondary">Ref {r.payment_reference}</p>
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="font-body-md text-body-md text-secondary py-4">No settlements yet. They appear once NEXORA books a courier shipment for your orders.</p>
        )}
      </section>
      <p className="font-body-sm text-body-sm text-secondary">
        Customers pay Cash on Delivery to the courier. After the courier remits the COD to NEXORA and it is verified, your payable amount (sales − courier deductions − NEXORA commission) becomes available and is paid out by NEXORA. Contact support if a figure looks wrong.
      </p>
    </div>
  );
}
