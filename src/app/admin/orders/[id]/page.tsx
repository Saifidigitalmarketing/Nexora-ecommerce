import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummaryBlocks, TrackingCard } from "@/components/account/OrderDetail";
import { StatusChip } from "@/components/account/StatusChip";
import { OrderActions } from "@/components/admin/OrderActions";
import { AdminPage, Card } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: items }, { data: history }, { data: riders }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_status_history").select("id, status, note, created_at").eq("order_id", id).order("created_at"),
    supabase.from("riders").select("id, zone_city, is_active, profile:profiles(full_name, phone)").eq("is_active", true),
  ]);
  const riderList = ((riders ?? []) as unknown as { id: string; zone_city: string | null; profile: { full_name: string | null; phone: string | null } | null }[]).map((r) => ({
    id: r.id,
    name: `${r.profile?.full_name || "Rider"}${r.profile?.phone ? ` (${r.profile.phone})` : ""}`,
    zone: r.zone_city,
  }));
  const o = order as Order;
  const assigned = riderList.find((r) => r.id === o.rider_id);

  return (
    <AdminPage
      title={o.order_number}
      subtitle={`Placed ${formatDateTime(o.created_at)}`}
      actions={
        <Link href="/admin/orders" className="font-label-md text-label-md text-primary flex items-center gap-1">
          <Icon name="arrow_back" className="text-[18px]" /> All orders
        </Link>
      }
    >
      <div className="grid lg:grid-cols-3 gap-space-md items-start">
        <div className="lg:col-span-2 flex flex-col gap-space-md">
          <Card title="Customer">
            <div className="grid sm:grid-cols-2 gap-2 font-body-md text-body-md">
              <p>
                <span className="text-secondary">Name:</span> {o.customer_name}
              </p>
              <p>
                <span className="text-secondary">Mobile:</span> <a className="text-primary" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a>
              </p>
              {o.customer_whatsapp ? (
                <p>
                  <span className="text-secondary">WhatsApp:</span>{" "}
                  <a className="text-primary" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${o.customer_whatsapp.replace(/\D/g, "").replace(/^0/, "92")}`}>
                    {o.customer_whatsapp}
                  </a>
                </p>
              ) : null}
              {o.customer_email ? (
                <p>
                  <span className="text-secondary">Email:</span> {o.customer_email}
                </p>
              ) : null}
            </div>
            {o.notes ? <p className="mt-2 p-2 rounded-lg bg-surface-container-low font-body-md text-body-md">Customer note: {o.notes}</p> : null}
            {o.cancel_reason ? <p className="mt-2 p-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">Cancelled: {o.cancel_reason}</p> : null}
          </Card>
          <OrderSummaryBlocks order={o} items={(items ?? []) as OrderItem[]} />
        </div>
        <div className="flex flex-col gap-space-md">
          <Card title="Status" actions={<StatusChip status={o.status} />}>
            {assigned ? (
              <p className="font-body-md text-body-md mb-3 flex items-center gap-1">
                <Icon name="two_wheeler" className="text-[18px] text-primary" /> {assigned.name}
                {o.rider_accepted_at ? <span className="text-primary font-label-md text-label-md"> · accepted</span> : <span className="text-secondary font-label-md text-label-md"> · awaiting acceptance</span>}
              </p>
            ) : null}
            <OrderActions order={o} riders={riderList} />
          </Card>
          <TrackingCard order={o} history={(history ?? []) as OrderStatusEvent[]} />
        </div>
      </div>
    </AdminPage>
  );
}
