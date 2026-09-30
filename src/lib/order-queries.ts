import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusEvent } from "@/lib/types";

/** Loads an order by number. RLS decides visibility (owner, assigned rider, admin). */
export async function getOrderByNumber(orderNumber: string) {
  const supabase = await getSupabaseServer();
  const { data: order } = await supabase.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id),
    supabase.from("order_status_history").select("id, status, note, created_at").eq("order_id", order.id).order("created_at"),
  ]);
  return { order: order as Order, items: (items ?? []) as OrderItem[], history: (history ?? []) as OrderStatusEvent[] };
}
