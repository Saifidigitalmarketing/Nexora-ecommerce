import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PaymentChip, StatusChip } from "@/components/account/StatusChip";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminPage, Card, Pager, Table, Td } from "@/components/admin/ui";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

const PAGE = 25;
const GROUPS: Record<string, string[]> = {
  open: ["placed", "confirmed", "processing"],
  transit: ["assigned", "picked_up", "on_the_way"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const supabase = await getSupabaseServer();
  let req = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, city, area, total, status, payment_method, payment_status, created_at, rider_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.status && GROUPS[sp.status]) req = req.in("status", GROUPS[sp.status]);
  if (sp.q) {
    const t = sp.q.replace(/[%,()*]/g, " ").trim();
    req = req.or(`order_number.ilike.%${t}%,customer_name.ilike.%${t}%,customer_phone.ilike.%${t}%`);
  }
  const { data, count } = await req;
  const orders = (data ?? []) as Order[];
  const qs = (p: number) => `/admin/orders?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;

  return (
    <AdminPage title="Orders" subtitle="Confirm, process, assign riders and track every order.">
      <Suspense>
        <FilterBar
          placeholder="Order no., name or phone"
          tabs={[
            { value: "", label: "All" },
            { value: "open", label: "To process" },
            { value: "transit", label: "In transit" },
            { value: "delivered", label: "Delivered" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </Suspense>
      <Card>
        <Table head={["Order", "Customer", "Deliver to", "Total", "Payment", "Status", "Placed"]}>
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-surface-container-low/50">
              <Td>
                <Link href={`/admin/orders/${o.id}`} className="font-label-lg text-label-lg text-primary whitespace-nowrap">
                  {o.order_number}
                </Link>
              </Td>
              <Td>
                <p>{o.customer_name}</p>
                <p className="font-body-sm text-body-sm text-secondary">{o.customer_phone}</p>
              </Td>
              <Td>
                <p>{o.city}</p>
                <p className="font-body-sm text-body-sm text-secondary">{o.area}</p>
              </Td>
              <Td className="tabular whitespace-nowrap">{formatPKR(o.total)}</Td>
              <Td>
                <p className="font-body-sm text-body-sm">{PAYMENT_LABEL[o.payment_method]}</p>
                <PaymentChip status={o.payment_status} method={o.payment_method} />
              </Td>
              <Td>
                <StatusChip status={o.status} />
              </Td>
              <Td className="text-secondary whitespace-nowrap">{formatDateTime(o.created_at)}</Td>
            </tr>
          ))}
        </Table>
        {!orders.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No orders match.</p> : null}
        <Pager page={page} total={count ?? 0} pageSize={PAGE} hrefFor={qs} />
      </Card>
    </AdminPage>
  );
}
