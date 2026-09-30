import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PaymentChip } from "@/components/account/StatusChip";
import { FilterBar } from "@/components/admin/FilterBar";
import { PaymentButtons } from "@/components/admin/PaymentButtons";
import { AdminPage, Card, Table, Td } from "@/components/admin/ui";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "awaiting_verification";
  const supabase = await getSupabaseServer();
  let req = supabase
    .from("orders")
    .select("id, order_number, customer_name, total, payment_method, payment_status, payment_reference, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") req = req.eq("payment_status", status);
  if (sp.q) req = req.or(`order_number.ilike.%${sp.q.replace(/[%,()*]/g, " ").trim()}%,payment_reference.ilike.%${sp.q.replace(/[%,()*]/g, " ").trim()}%`);
  const { data } = await req;
  const rows = (data ?? []) as Order[];
  return (
    <AdminPage title="Payments" subtitle="Verify Easypaisa, JazzCash and bank transfers by Transaction ID. COD is marked paid on delivery.">
      <Suspense>
        <FilterBar
          placeholder="Order no. or TID"
          tabs={[
            { value: "awaiting_verification", label: "To verify" },
            { value: "pending", label: "Pending" },
            { value: "paid", label: "Paid" },
            { value: "failed", label: "Failed" },
            { value: "all", label: "All" },
          ]}
        />
      </Suspense>
      <Card>
        <Table head={["Order", "Customer", "Method", "Amount", "Transaction ID", "Status", ""]}>
          {rows.map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/admin/orders/${o.id}`} className="font-label-lg text-label-lg text-primary whitespace-nowrap">
                  {o.order_number}
                </Link>
                <p className="font-body-sm text-body-sm text-secondary">{formatDateTime(o.created_at)}</p>
              </Td>
              <Td>{o.customer_name}</Td>
              <Td>{PAYMENT_LABEL[o.payment_method]}</Td>
              <Td className="tabular whitespace-nowrap">{formatPKR(o.total)}</Td>
              <Td className="font-label-md text-label-md">{o.payment_reference ?? "—"}</Td>
              <Td>
                <PaymentChip status={o.payment_status} />
              </Td>
              <Td>{o.payment_method !== "cod" && o.payment_status !== "paid" && o.status !== "cancelled" ? <PaymentButtons orderId={o.id} /> : null}</Td>
            </tr>
          ))}
        </Table>
        {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No payments in this view.</p> : null}
      </Card>
    </AdminPage>
  );
}
