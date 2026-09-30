"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "@/components/providers/CartProvider";

/**
 * Re-reads current price/stock for every cart line from the database so
 * the cart never shows stale prices. The server re-prices again in
 * place_order(), so this is for display only.
 */
export async function refreshCartItems(supabase: SupabaseClient, items: CartItem[]): Promise<CartItem[]> {
  if (!items.length) return items;
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = items.map((i) => i.variantId).filter((v): v is string => !!v);

  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from("products").select("id, name, slug, price, compare_at_price, stock, is_active, vendor:vendors(name, slug, badge), images:product_images(url, sort_order)").in("id", productIds),
    variantIds.length
      ? supabase.from("product_variants").select("id, label, price, compare_at_price, stock, is_active").in("id", variantIds)
      : Promise.resolve({ data: [] as { id: string; label: string; price: number; compare_at_price: number | null; stock: number; is_active: boolean }[] }),
  ]);

  type P = { id: string; name: string; slug: string; price: number; compare_at_price: number | null; stock: number; is_active: boolean; vendor: { name: string; slug: string; badge: string | null } | null; images: { url: string; sort_order: number }[] };
  const pMap = new Map(((products ?? []) as unknown as P[]).map((p) => [p.id, p]));
  const vMap = new Map((variants ?? []).map((v) => [v.id, v]));

  return items.map((item) => {
    const p = pMap.get(item.productId);
    if (!p || !p.is_active) return { ...item, unavailable: true, selected: false };
    const img = [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? item.image;
    if (item.variantId) {
      const v = vMap.get(item.variantId);
      if (!v || !v.is_active) return { ...item, unavailable: true, selected: false };
      return {
        ...item,
        name: p.name,
        slug: p.slug,
        image: img,
        vendor: p.vendor,
        variantLabel: v.label,
        price: Number(v.price),
        compareAt: v.compare_at_price != null ? Number(v.compare_at_price) : null,
        maxStock: v.stock,
        quantity: Math.max(1, Math.min(item.quantity, v.stock || 1)),
        unavailable: v.stock <= 0,
        selected: v.stock <= 0 ? false : item.selected,
      };
    }
    return {
      ...item,
      name: p.name,
      slug: p.slug,
      image: img,
      vendor: p.vendor,
      price: Number(p.price),
      compareAt: p.compare_at_price != null ? Number(p.compare_at_price) : null,
      maxStock: p.stock,
      quantity: Math.max(1, Math.min(item.quantity, p.stock || 1)),
      unavailable: p.stock <= 0,
      selected: p.stock <= 0 ? false : item.selected,
    };
  });
}

export function cartTotals(items: CartItem[]) {
  const selected = items.filter((i) => i.selected && !i.unavailable);
  const subtotal = selected.reduce((n, i) => n + i.price * i.quantity, 0);
  const original = selected.reduce((n, i) => n + Math.max(i.compareAt ?? i.price, i.price) * i.quantity, 0);
  return { selected, subtotal, original, promotions: original - subtotal, count: selected.reduce((n, i) => n + i.quantity, 0) };
}
