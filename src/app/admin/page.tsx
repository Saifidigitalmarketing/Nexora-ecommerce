import Link from "next/link";
import { StatusChip, PaymentChip } from "@/components/account/StatusChip";
import { SalesChart } from "@/components/admin/SalesChart";
import { AdminPage, Card, StatCard, Table, Td } from "@/components/admin/ui";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

interface Stats {
  revenue_total: number;
  revenue_today: number;
  orders_total: number;
  orders_pending: number;
  orders_in_transit: number;
  orders_delivered: number;
  payments_to_verify: number;
  customers_total: number;
  products_total: number;
  low_stock: number;
  sales_last_14_days: { day: string; total: number; orders: number }[];
}

export default async function AdminDashboard() {
  const supabase = await getSupabaseServer();
  const [{ data: stats, error }, { data: recent }, { data: lowStock }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.from("orders").select("id, order_number, customer_name, city, total, status, payment_status, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("products").select("id, name, stock").eq("is_active", true).lte("stock", 5).order("stock").limit(8),
  ]);
  if (error) throw new Error(error.message);
  const s = stats as Stats;

  return (
    <AdminPage title="Dashboard" subtitle="Everything happening on NEXORA today.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">
        <StatCard icon="payments" label="Revenue today" value={formatPKR(s.revenue_today)} hint={`${formatPKR(s.revenue_total)} all time`} />
        <StatCard icon="pending_actions" label="To process" value={s.orders_pending} hint="Placed / confirmed / processing" href="/admin/orders?status=open" />
        <StatCard icon="two_wheeler" label="In transit" value={s.orders_in_transit} hint={`${s.orders_delivered} delivered`} href="/admin/orders?status=transit" />
        <StatCard icon="fact_check" label="Payments to verify" value={s.payments_to_verify} href="/admin/payments" />
        <StatCard icon="receipt_long" label="Orders" value={s.orders_total} href="/admin/orders" />
        <StatCard icon="group" label="Customers" value={s.customers_total} href="/admin/customers" />
        <StatCard icon="inventory_2" label="Products" value={s.products_total} href="/admin/products" />
        <StatCard icon="warning" label="Low stock" value={s.low_stock} hint="5 or fewer units" href="/admin/inventory?low=1" />
      </div>

      <div className="grid lg:grid-cols-3 gap-space-md">
        <Card title="Sales — last 14 days" className="lg:col-span-2">
          <SalesChart data={s.sales_last_14_days} />
        </Card>
        <Card title="Low stock" actions={<Link href="/admin/inventory" className="font-label-md text-label-md text-primary">Inventory</Link>}>
          {lowStock?.length ? (
            <ul className="flex flex-col divide-y divide-surface-container-low">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 gap-2">
                  <Link href={`/admin/products/${p.id}`} className="font-body-md text-body-md truncate hover:text-primary">
                    {p.name}
                  </Link>
                  <span className={`font-label-md text-label-md ${p.stock === 0 ? "text-error" : "text-on-surface"}`}>{p.stock}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body-md text-body-md text-secondary">All products are well stocked.</p>
          )}
        </Card>
      </div>

      <Card title="Recent orders" actions={<Link href="/admin/orders" className="font-label-md text-label-md text-primary">View all</Link>}>
        <Table head={["Order", "Customer", "City", "Total", "Status", "Payment", "Placed"]}>
          {((recent ?? []) as Order[]).map((o) => (
            <tr key={o.id} className="hover:bg-surface-container-low/50">
              <Td>
                <Link href={`/admin/orders/${o.id}`} className="font-label-lg text-label-lg text-primary">
                  {o.order_number}
                </Link>
              </Td>
              <Td>{o.customer_name}</Td>
              <Td>{o.city}</Td>
              <Td className="tabular">{formatPKR(o.total)}</Td>
              <Td>
                <StatusChip status={o.status} />
              </Td>
              <Td>
                <PaymentChip status={o.payment_status} />
              </Td>
              <Td className="text-secondary whitespace-nowrap">{formatDateTime(o.created_at)}</Td>
            </tr>
          ))}
        </Table>
        {!recent?.length ? <p className="font-body-md text-body-md text-secondary py-4">No orders yet.</p> : null}
      </Card>
    </AdminPage>
  );
}
