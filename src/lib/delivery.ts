import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryQuote } from "./types";

/**
 * Delivery charges are computed by the `calculate_delivery` database
 * function (supabase/migrations/..._functions.sql) so the same rules apply
 * to the storefront estimate and to place_order(). Change pricing there or
 * from Admin → Delivery; the frontend only displays the quote.
 */
export async function getDeliveryQuote(
  supabase: SupabaseClient,
  input: { province: string; city: string; area?: string; subtotal: number },
): Promise<DeliveryQuote | null> {
  const { data, error } = await supabase.rpc("calculate_delivery", {
    p_province: input.province,
    p_city: input.city,
    p_area: input.area ?? "",
    p_subtotal: input.subtotal,
  });
  if (error || !data?.[0]) return null;
  const r = data[0];
  return {
    charge: Number(r.charge),
    eta_min_days: r.eta_min_days,
    eta_max_days: r.eta_max_days,
    zone_name: r.zone_name,
    is_free: r.is_free,
    free_threshold: r.free_threshold != null ? Number(r.free_threshold) : null,
  };
}

export function etaLabel(minDays: number, maxDays: number): string {
  const fmt = (d: number) => {
    const date = new Date(Date.now() + d * 86400000);
    return new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" }).format(date);
  };
  if (minDays <= 1 && maxDays <= 1) return "Tomorrow";
  if (minDays === maxDays) return fmt(minDays);
  return `${fmt(minDays)} – ${fmt(maxDays)}`;
}
