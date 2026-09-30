import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackingCard } from "@/components/account/OrderDetail";
import { RiderOrderCard } from "@/components/rider/RiderOrderCard";
import { Icon } from "@/components/ui/Icon";
import { getSession, getSupabaseServer } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusEvent } from "@/lib/types";

export default async function RiderOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getSession();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("orders").select("*, items:order_items(*)").eq("id", id).eq("rider_id", userId!).maybeSingle();
  if (!data) notFound();
  const { data: history } = await supabase.from("order_status_history").select("id, status, note, created_at").eq("order_id", id).order("created_at");
  const order = data as Order & { items: OrderItem[] };
  return (
    <div className="flex flex-col gap-space-md">
      <Link href="/rider" className="font-label-md text-label-md text-primary flex items-center gap-1">
        <Icon name="arrow_back" className="text-[18px]" /> Back
      </Link>
      <RiderOrderCard order={order} items={order.items} />
      <TrackingCard order={order} history={(history ?? []) as OrderStatusEvent[]} />
    </div>
  );
}
