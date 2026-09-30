"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/ui/Toast";
import { cn, discountPercent, formatPKR } from "@/lib/format";
import type { ProductDetail, ProductVariant } from "@/lib/types";
import { DeliveryInfo } from "./DeliveryInfo";

/** Price block, variant selectors, quantity, delivery and the sticky buy dock. */
export function ProductPurchase({ product }: { product: ProductDetail }) {
  const { add, buyNow } = useCart();
  const toast = useToast();
  const router = useRouter();
  const variants = product.variants;

  // option groups in first-seen order, e.g. Finish → [..], Storage → [..]
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    variants.forEach((v) =>
      Object.entries(v.options ?? {}).forEach(([k, val]) => {
        const arr = map.get(k) ?? [];
        if (!arr.includes(val)) arr.push(val);
        map.set(k, arr);
      }),
    );
    return [...map.entries()];
  }, [variants]);

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant: ProductVariant | undefined = variants.length
    ? variants.find((v) => groups.every(([k]) => v.options?.[k] === selection[k]))
    : undefined;

  const price = Number(variant?.price ?? product.price);
  const compareAt = variant ? variant.compare_at_price : product.compare_at_price;
  const stock = variants.length ? (variant?.stock ?? 0) : product.stock;
  const pct = discountPercent(price, compareAt);
  const unavailable = variants.length > 0 && !variant;

  const colorFor = (group: string, value: string) => variants.find((v) => v.options?.[group] === value)?.color_hex;
  const priceFor = (group: string, value: string) => {
    const v = variants.find((x) => groups.every(([k]) => (k === group ? x.options?.[k] === value : x.options?.[k] === selection[k])));
    return v ? Number(v.price) : null;
  };

  const item = () => ({
    productId: product.id,
    variantId: variant?.id ?? null,
    name: product.name,
    slug: product.slug,
    image: product.images[0]?.url ?? null,
    price,
    compareAt: compareAt != null ? Number(compareAt) : null,
    variantLabel: variant?.label ?? null,
    vendor: product.vendor ? { name: product.vendor.name, slug: product.vendor.slug, badge: product.vendor.badge } : null,
    maxStock: stock,
    quantity: qty,
  });

  const canBuy = !unavailable && stock > 0;

  return (
    <>
      {/* Pricing */}
      <div className="flex flex-col mt-space-xs p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="flex items-baseline gap-space-sm flex-wrap">
          <span className="font-price-lg text-price-lg text-on-surface tabular">{formatPKR(price)}</span>
          {compareAt && compareAt > price ? <span className="font-body-md text-body-md line-through text-outline tabular">{formatPKR(compareAt)}</span> : null}
          {pct ? <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">-{pct}% OFF</span> : null}
        </div>
        <div className="mt-space-sm flex items-center gap-2 font-label-md text-label-md">
          {unavailable ? (
            <span className="text-error">This combination is not available</span>
          ) : stock <= 0 ? (
            <span className="flex items-center gap-1 text-error">
              <Icon name="block" className="text-[16px]" /> Out of stock
            </span>
          ) : stock <= 5 ? (
            <span className="flex items-center gap-1 text-error">
              <Icon name="local_fire_department" className="text-[16px]" /> Only {stock} left in stock
            </span>
          ) : (
            <span className="flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> In stock
            </span>
          )}
        </div>
      </div>

      {/* Variant selectors */}
      {groups.length ? (
        <div className="flex flex-col mt-space-md gap-space-md">
          {groups.map(([group, values]) => {
            // a colour group is one where each value maps to exactly one distinct swatch
            const hexes = values.map((v) => new Set(variants.filter((x) => x.options?.[group] === v).map((x) => x.color_hex)));
            const isColor =
              hexes.every((h) => h.size === 1 && [...h][0]) && new Set(hexes.map((h) => [...h][0])).size === values.length;
            return (
              <div key={group} className="flex flex-col gap-space-xs bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface">
                    {group}: <span className="text-primary">{selection[group]}</span>
                  </span>
                </div>
                {isColor ? (
                  <div className="flex items-center gap-space-sm pt-space-xs flex-wrap" role="radiogroup" aria-label={group}>
                    {values.map((val) => {
                      const active = selection[group] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={val}
                          title={val}
                          onClick={() => setSelection({ ...selection, [group]: val })}
                          className={cn(
                            "relative w-10 h-10 rounded-full p-0.5 shadow-sm transition-transform active:scale-95",
                            active ? "bg-primary" : "bg-surface-container-highest",
                          )}
                        >
                          <span className="block w-full h-full rounded-full shadow-inner" style={{ background: colorFor(group, val) ?? "#ddd" }} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={cn("grid gap-space-sm pt-space-xs", values.length > 3 ? "grid-cols-4" : "grid-cols-3")} role="radiogroup" aria-label={group}>
                    {values.map((val) => {
                      const active = selection[group] === val;
                      const p = priceFor(group, val);
                      return (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSelection({ ...selection, [group]: val })}
                          className={cn(
                            "flex flex-col items-center justify-center p-space-sm rounded-lg transition-colors",
                            active ? "bg-surface-container text-on-surface shadow-sm ring-1 ring-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                          )}
                        >
                          <span className="font-label-lg text-label-lg">{val}</span>
                          {p != null && groups.length > 0 && new Set(variants.map((v) => v.price)).size > 1 ? (
                            <span className="font-body-sm text-body-sm text-secondary tabular">{formatPKR(p)}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Quantity */}
      <div className="flex items-center justify-between mt-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
        <span className="font-label-lg text-label-lg text-on-surface">Quantity</span>
        <QuantityStepper value={qty} max={Math.max(1, Math.min(20, stock))} onChange={setQty} size="md" />
      </div>

      <div className="mt-space-md">
        <DeliveryInfo price={price * qty} />
      </div>

      {/* Sticky bottom shopping dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-safe">
        <div className="px-margin py-space-sm flex items-center justify-between gap-space-sm max-w-screen-md mx-auto">
          <div className="flex items-center gap-1 shrink-0">
            <Link href="/help" aria-label="Customer support" className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-on-surface hover:text-primary transition-colors">
              <Icon name="chat_bubble" className="text-[20px]" />
              <span className="font-label-sm text-[10px] text-secondary">Chat</span>
            </Link>
            {product.vendor ? (
              <Link
                href={`/search?store=${product.vendor.slug}`}
                aria-label={`Visit ${product.vendor.name}`}
                className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-on-surface hover:text-primary transition-colors"
              >
                <Icon name="storefront" className="text-[20px]" />
                <span className="font-label-sm text-[10px] text-secondary">Store</span>
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-grow">
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => {
                add(item());
                setAdded(true);
                toast("Added to cart");
                setTimeout(() => setAdded(false), 1800);
              }}
              className="flex-1 h-11 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex flex-col items-center justify-center leading-tight transition-transform active:scale-95 shadow-sm disabled:opacity-50"
            >
              {added ? (
                <span className="flex items-center gap-1 text-primary">
                  <Icon name="check_circle" className="text-[18px]" /> Added!
                </span>
              ) : (
                <>
                  <span>Add to Cart</span>
                  <span className="font-label-sm text-[11px] text-primary tabular">{formatPKR(price * qty)}</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => {
                buyNow(item());
                router.push("/checkout");
              }}
              className="flex-1 h-11 px-2 rounded-lg bg-on-surface hover:bg-primary transition-colors text-surface font-label-lg text-label-lg flex items-center justify-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Icon name="bolt" className="text-[18px]" />
              <span>{stock <= 0 && !unavailable ? "Sold Out" : "Buy Now"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
