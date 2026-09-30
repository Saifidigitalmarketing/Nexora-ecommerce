"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useDeliveryLocation } from "@/components/providers/LocationProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { ProductImage } from "@/components/product/ProductImage";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cartTotals, refreshCartItems } from "@/lib/cart-sync";
import { getDeliveryQuote } from "@/lib/delivery";
import { formatPKR } from "@/lib/format";
import type { DeliveryQuote } from "@/lib/types";
import { CouponBox, type CouponResult } from "./CouponBox";

function groupByStore(items: CartItem[]) {
  const map = new Map<string, { name: string; badge: string | null; items: CartItem[] }>();
  items.forEach((i) => {
    const key = i.vendor?.slug ?? "nexora";
    const g = map.get(key) ?? { name: i.vendor?.name ?? "NEXORA", badge: i.vendor?.badge ?? null, items: [] };
    g.items.push(i);
    map.set(key, g);
  });
  return [...map.entries()];
}

export function CartView() {
  const cart = useCart();
  const { userId } = useAuth();
  const { toggle: toggleWish, has: inWishlist } = useWishlist();
  const { location } = useDeliveryLocation();
  const router = useRouter();
  const toast = useToast();
  const [refreshed, setRefreshed] = useState(false);
  const [coupon, setCouponResult] = useState<CouponResult | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const didRefresh = useRef(false);

  // Refresh prices/stock once after the cart loads from storage
  useEffect(() => {
    if (!cart.ready || didRefresh.current) return;
    didRefresh.current = true;
    if (!cart.items.length) {
      setRefreshed(true);
      return;
    }
    refreshCartItems(getSupabaseBrowser(), cart.items)
      .then((fresh) => cart.replace(fresh))
      .finally(() => setRefreshed(true));
  }, [cart.ready, cart]);

  const totals = useMemo(() => cartTotals(cart.items), [cart.items]);
  const discount = coupon?.discount ?? 0;
  const afterDiscount = Math.max(0, totals.subtotal - discount);

  useEffect(() => {
    if (!totals.count) return;
    let cancelled = false;
    getDeliveryQuote(getSupabaseBrowser(), { province: location.province, city: location.city, subtotal: afterDiscount }).then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [location.province, location.city, afterDiscount, totals.count]);

  if (!cart.ready || !refreshed) return <PageLoader label="Loading your cart…" />;

  if (!cart.items.length) {
    return (
      <EmptyState
        icon="shopping_bag"
        title="Your cart is empty"
        description="Browse authentic products from official stores and add them here."
        action={<ButtonLink href="/">Start shopping</ButtonLink>}
      />
    );
  }

  const delivery = quote?.charge ?? 0;
  const grand = afterDiscount + (totals.count ? delivery : 0);
  const allSelected = cart.items.filter((i) => !i.unavailable).every((i) => i.selected);
  const groups = groupByStore(cart.items);
  const freeThreshold = quote?.free_threshold ?? null;

  const saveForLater = async (item: CartItem) => {
    if (!userId) {
      router.push("/login?next=/cart");
      return;
    }
    if (!inWishlist(item.productId)) await toggleWish(item.productId);
    cart.remove(item.key);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Delivery incentive */}
      <div className="px-margin pt-space-sm pb-space-xs">
        <div className="bg-surface-container-lowest shadow-sm rounded-xl p-space-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon name="local_shipping" className="text-[16px]" />
              </div>
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {quote?.is_free
                  ? "Free Delivery Unlocked!"
                  : freeThreshold
                    ? `Add ${formatPKR(Math.max(0, freeThreshold - afterDiscount))} for free delivery`
                    : `Delivery to ${location.city}: ${quote ? formatPKR(quote.charge) : "…"}`}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10 shrink-0">{quote?.zone_name ?? location.city}</span>
          </div>
          {freeThreshold ? (
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (afterDiscount / freeThreshold) * 100)}%` }} />
            </div>
          ) : null}
          <p className="font-body-sm text-body-sm text-secondary">
            {freeThreshold ? `Orders over ${formatPKR(freeThreshold)} qualify for free delivery.` : "Delivery charge depends on your city and area. Change city from the header."}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-margin py-space-sm flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-primary rounded cursor-pointer" checked={allSelected} onChange={(e) => cart.setAllSelected(e.target.checked)} />
          <span className="font-label-md text-label-md text-on-surface font-medium">Select All ({cart.items.length} items)</span>
        </label>
        <button
          type="button"
          onClick={() => {
            if (confirm("Remove all items from your cart?")) cart.clear();
          }}
          className="flex items-center gap-1 font-label-md text-label-md text-secondary hover:text-error transition-colors"
        >
          <Icon name="delete_sweep" className="text-[16px]" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="px-margin flex flex-col gap-space-md lg:grid lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-space-md">
          {groups.map(([slug, g]) => {
            const storeSelected = g.items.filter((i) => !i.unavailable).every((i) => i.selected);
            return (
              <div key={slug} className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden p-space-sm flex flex-col gap-space-sm">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`Select all from ${g.name}`}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                      checked={storeSelected}
                      onChange={(e) => g.items.forEach((i) => !i.unavailable && cart.toggleSelected(i.key, e.target.checked))}
                    />
                    <Icon name="verified" className="text-[18px] text-primary" />
                    <Link href={`/search?store=${slug}`} className="font-label-lg text-label-lg text-on-surface font-bold truncate">
                      {g.name}
                    </Link>
                  </div>
                  {g.badge ? <span className="font-label-sm text-label-sm bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full shrink-0">{g.badge}</span> : null}
                </div>
                {g.items.map((item) => (
                  <div key={item.key} className="flex flex-col gap-1">
                    <div className="flex gap-3 bg-surface-container-low/50 p-2.5 rounded-lg relative">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.name}`}
                        className="w-4 h-4 accent-primary rounded cursor-pointer self-center"
                        checked={item.selected && !item.unavailable}
                        disabled={item.unavailable}
                        onChange={(e) => cart.toggleSelected(item.key, e.target.checked)}
                      />
                      <Link href={`/product/${item.slug}`} className="w-20 h-20 rounded-lg overflow-hidden bg-surface-container flex-shrink-0 relative">
                        <ProductImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        {item.variantLabel ? (
                          <div className="absolute bottom-1 right-1 bg-on-surface/80 backdrop-blur text-surface font-label-sm text-[9px] px-1 rounded max-w-[72px] truncate">
                            {item.variantLabel.split(" / ").pop()}
                          </div>
                        ) : null}
                      </Link>
                      <div className="flex flex-col flex-1 min-w-0 justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <Link href={`/product/${item.slug}`} className="font-label-lg text-label-lg text-on-surface font-semibold truncate leading-tight">
                              {item.name}
                            </Link>
                            <button
                              type="button"
                              className="text-secondary hover:text-error transition-colors p-1 -mt-1"
                              title="Remove item"
                              aria-label={`Remove ${item.name}`}
                              onClick={() => {
                                cart.remove(item.key);
                                toast("Removed from cart");
                              }}
                            >
                              <Icon name="delete" className="text-[18px]" />
                            </button>
                          </div>
                          <p className="font-body-sm text-body-sm text-secondary truncate mt-0.5">{item.variantLabel ?? (item.vendor?.badge ? item.vendor.badge : " ")}</p>
                        </div>
                        {item.unavailable ? (
                          <p className="font-label-md text-label-md text-error mt-2">Currently unavailable</p>
                        ) : (
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <div className="flex flex-col tabular">
                              <span className="font-price-md text-price-md text-on-surface whitespace-nowrap">{formatPKR(item.price)}</span>
                              {item.compareAt && item.compareAt > item.price ? (
                                <span className="font-body-sm text-body-sm text-secondary line-through">{formatPKR(item.compareAt)}</span>
                              ) : null}
                            </div>
                            <QuantityStepper value={item.quantity} max={Math.max(1, Math.min(20, item.maxStock))} onChange={(q) => cart.setQuantity(item.key, q)} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => void saveForLater(item)}
                        className="flex items-center gap-1 font-label-sm text-label-sm text-secondary hover:text-primary transition-colors"
                      >
                        <Icon name="bookmark_border" className="text-[14px]" />
                        <span>Save for later</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-space-md lg:sticky lg:top-[76px]">
          <CouponBox
            code={cart.coupon}
            subtotal={totals.subtotal}
            onChange={(code, res) => {
              if (code !== cart.coupon) cart.setCoupon(code);
              setCouponResult(res);
            }}
          />

          <div className="grid grid-cols-3 gap-2 py-1">
            {[
              { icon: "payments", t: "Cash on Delivery", s: "Nationwide" },
              { icon: "account_balance_wallet", t: "JazzCash / Easypaisa", s: "Mobile wallets" },
              { icon: "replay", t: "7-Day Easy Return", s: "Hassle-free" },
            ].map((b) => (
              <div key={b.t} className="bg-surface-container-low p-2 rounded-lg flex flex-col items-center text-center gap-1 shadow-sm">
                <Icon name={b.icon} className="text-[20px] text-primary" />
                <span className="font-label-sm text-[10px] leading-tight text-on-surface font-semibold">{b.t}</span>
                <span className="font-label-sm text-[9px] text-secondary">{b.s}</span>
              </div>
            ))}
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col gap-2.5 mb-2 tabular">
            <span className="font-label-lg text-label-lg text-on-surface font-bold pb-1">Order Summary</span>
            <div className="flex items-center justify-between">
              <span className="font-body-md text-body-md text-secondary">Subtotal ({totals.count} items)</span>
              <span className="font-body-md text-body-md text-on-surface font-medium">{formatPKR(totals.original)}</span>
            </div>
            {totals.promotions > 0 ? (
              <div className="flex items-center justify-between text-primary">
                <span className="font-body-md text-body-md">Store Promotions</span>
                <span className="font-body-md text-body-md font-medium">- {formatPKR(totals.promotions)}</span>
              </div>
            ) : null}
            {coupon ? (
              <div className="flex items-center justify-between text-primary">
                <span className="font-body-md text-body-md">Voucher ({coupon.code})</span>
                <span className="font-body-md text-body-md font-medium">- {formatPKR(coupon.discount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="font-body-md text-body-md text-secondary">Delivery ({location.city})</span>
              {quote?.charge === 0 ? (
                <span className="font-label-md text-label-md text-primary font-bold">FREE</span>
              ) : (
                <span className="font-body-md text-body-md text-on-surface font-medium">{quote ? formatPKR(delivery) : "—"}</span>
              )}
            </div>
            <div className="h-px bg-surface-container-high my-1" />
            <div className="flex items-baseline justify-between pt-0.5">
              <div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Grand Total</span>
                <p className="font-label-sm text-[10px] text-secondary">Final delivery charge confirmed at checkout</p>
              </div>
              <span className="font-price-lg text-price-lg text-on-surface font-extrabold">{formatPKR(grand)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky checkout dock (sits above the tab bar on mobile) */}
      <div className="sticky bottom-16 lg:bottom-0 z-40 mt-space-sm bg-surface-container-lowest/95 backdrop-blur-md px-margin py-space-sm shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0 tabular">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Total Payable</span>
          <span className="font-price-md text-price-md text-on-surface font-bold leading-tight">{formatPKR(grand)}</span>
          {totals.promotions + discount > 0 ? (
            <span className="font-label-sm text-label-sm text-primary font-semibold truncate">Saved {formatPKR(totals.promotions + discount)} today 🎉</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!totals.count}
          onClick={() => router.push(userId ? "/checkout" : "/login?next=/checkout")}
          className="flex-1 max-w-[220px] h-12 bg-on-surface text-surface rounded-xl flex items-center justify-center gap-2 px-4 shadow-md hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="font-label-lg text-label-lg font-bold">Checkout ({totals.count})</span>
          <Icon name="arrow_forward" className="text-[18px]" />
        </button>
      </div>
    </div>
  );
}
