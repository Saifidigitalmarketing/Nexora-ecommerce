import Link from "next/link";
import { RiderOrderCard } from "@/components/rider/RiderOrderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSession, getSupabaseServer } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

/** Start of today in Asia/Karachi (UTC+5, no DST) as an ISO timestamp. */
function karachiMidnightISO() {
  const offset = 5 * 3600 * 1000;
  const day = 86400 * 1000;
  return new Date(Math.floor((Date.now() + offset) / day) * day - offset).toISOString();
}

export default async function RiderHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const completed = tab === "completed";
  const { userId } = await getSession();
  const supabase = await getSupabaseServer();
  // RLS already restricts to this rider; the filter keeps intent explicit.
  let req = supabase.from("orders").select("*, items:order_items(*)").eq("rider_id", userId!);
  req = completed ? req.eq("status", "delivered").order("delivered_at", { ascending: false }).limit(50) : req.in("status", ["assigned", "picked_up", "on_the_way"]).order("created_at");
  const { data } = await req;
  const orders = (data ?? []) as (Order & { items: OrderItem[] })[];

  const { data: todayDone } = await supabase
    .from("orders")
    .select("total, payment_method")
    .eq("rider_id", userId!)
    .eq("status", "delivered")
    .gte("delivered_at", karachiMidnightISO());
  const cashToday = (todayDone ?? []).filter((o) => o.payment_method === "cod").reduce((n, o) => n + Number(o.total), 0);

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 gap-space-sm">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md">
          <p className="font-label-sm text-label-sm uppercase text-secondary">Delivered today</p>
          <p className="font-price-md text-price-md">{todayDone?.length ?? 0}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md">
          <p className="font-label-sm text-label-sm uppercase text-secondary">Cash collected today</p>
          <p className="font-price-md text-price-md tabular">{formatPKR(cashToday)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/rider" className={`px-4 py-2 rounded-full font-label-lg text-label-lg ${!completed ? "bg-on-surface text-surface" : "bg-surface-container-lowest shadow-sm"}`}>
          Assigned
        </Link>
        <Link href="/rider?tab=completed" className={`px-4 py-2 rounded-full font-label-lg text-label-lg ${completed ? "bg-on-surface text-surface" : "bg-surface-container-lowest shadow-sm"}`}>
          Completed
        </Link>
      </div>
      {orders.length ? (
        orders.map((o) => <RiderOrderCard key={o.id} order={o} items={o.items} compact={completed} />)
      ) : (
        <EmptyState icon="two_wheeler" title={completed ? "No completed deliveries yet" : "No orders assigned"} description={completed ? undefined : "New deliveries assigned to you will appear here."} />
      )}
    </div>
  );
}
