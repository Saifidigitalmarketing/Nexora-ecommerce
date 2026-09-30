import type { Metadata } from "next";
import Link from "next/link";
import { ExportCsv } from "@/components/admin/ExportCsv";
import { AdminPage, Card, StatCard, Table, Td } from "@/components/admin/ui";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/orders";
import { formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order, PaymentMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

const RANGES = [
  { v: "7", l: "7 days" },
  { v: "30", l: "30 days" },
  { v: "90", l: "90 days" },
  { v: "365", l: "12 months" },
];

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.some((r) => r.v === sp.days) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, created_at, customer_name, city, total, subtotal, discount_total, delivery_charge, payment_method, payment_status, status, items:order_items(product_name, quantity, line_total)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  const orders = (data ?? []) as (Order & { items: { product_name: string; quantity: number; line_total: number }[] })[];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const revenue = valid.reduce((n, o) => n + Number(o.total), 0);
  const aov = valid.length ? revenue / valid.length : 0;
  const cancelled = orders.length - valid.length;

  const group = <K extends string>(key: (o: (typeof valid)[number]) => K) => {
    const m = new Map<K, { n: number; total: number }>();
    valid.forEach((o) => {
      const k = key(o);
      const g = m.get(k) ?? { n: 0, total: 0 };
      g.n += 1;
      g.total += Number(o.total);
      m.set(k, g);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  };
  const byMethod = group((o) => o.payment_method);
  const byCity = group((o) => o.city).slice(0, 10);
  const products = new Map<string, { q: number; total: number }>();
  valid.forEach((o) =>
    o.items.forEach((i) => {
      const p = products.get(i.product_name) ?? { q: 0, total: 0 };
      p.q += i.quantity;
      p.total += Number(i.line_total);
      products.set(i.product_name, p);
    }),
  );
  const top = [...products.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const csv = orders.map((o) => ({
    order: o.order_number,
    date: o.created_at,
    customer: o.customer_name,
    city: o.city,
    subtotal: o.subtotal,
    discount: o.discount_total,
    delivery: o.delivery_charge,
    total: o.total,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    status: o.status,
  }));

  return (
    <AdminPage
      title="Reports"
      subtitle={`Last ${days} days`}
      actions={
        <>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Link key={r.v} href={`/admin/reports?days=${r.v}`} className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${Number(r.v) === days ? "bg-on-surface text-surface" : "bg-surface-container-lowest shadow-sm"}`}>
                {r.l}
              </Link>
            ))}
          </div>
          <ExportCsv rows={csv} filename={`nexora-orders-${days}d.csv`} />
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">
        <StatCard icon="payments" label="Revenue" value={formatPKR(revenue)} />
        <StatCard icon="receipt_long" label="Orders" value={valid.length} hint={`${cancelled} cancelled`} />
        <StatCard icon="shopping_cart" label="Avg. order value" value={formatPKR(aov)} />
        <StatCard icon="local_shipping" label="Delivered" value={valid.filter((o) => o.status === "delivered").length} hint={STATUS_LABEL.delivered} />
      </div>
      <div className="grid lg:grid-cols-2 gap-space-md">
        <Card title="Top products">
          <Table head={["Product", "Units", "Sales"]}>
            {top.map(([name, p]) => (
              <tr key={name}>
                <Td>{name}</Td>
                <Td>{p.q}</Td>
                <Td className="tabular">{formatPKR(p.total)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <div className="flex flex-col gap-space-md">
          <Card title="By payment method">
            <Table head={["Method", "Orders", "Sales"]}>
              {byMethod.map(([m, g]) => (
                <tr key={m}>
                  <Td>{PAYMENT_LABEL[m as PaymentMethod]}</Td>
                  <Td>{g.n}</Td>
                  <Td className="tabular">{formatPKR(g.total)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Top cities">
            <Table head={["City", "Orders", "Sales"]}>
              {byCity.map(([c, g]) => (
                <tr key={c}>
                  <Td>{c}</Td>
                  <Td>{g.n}</Td>
                  <Td className="tabular">{formatPKR(g.total)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
