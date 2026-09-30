"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cn, formatNumber } from "@/lib/format";
import type { Brand } from "@/lib/types";
import type { ListingState } from "./params";

const SORT_LABELS: Record<ListingState["sort"], string> = {
  popular: "Most Popular",
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  rating: "Top Rated",
};

const PRICE_PRESETS = [
  { label: "Under Rs. 5k", max: 5000 },
  { label: "Rs. 5k – 20k", min: 5000, max: 20000 },
  { label: "Rs. 20k – 50k", min: 20000, max: 50000 },
  { label: "Rs. 50k – 100k", min: 50000, max: 100000 },
  { label: "Above Rs. 100k", min: 100000 },
];

function Pill({ active, onClick, children, onClear }: { active?: boolean; onClick?: () => void; children: ReactNode; onClear?: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-sm shrink-0",
        active ? "bg-primary-fixed/30 text-on-primary-fixed-variant" : "bg-surface-container-lowest text-secondary hover:text-on-surface",
      )}
    >
      <button type="button" onClick={onClick} className="flex items-center gap-1.5 font-label-md text-label-md">
        {children}
      </button>
      {onClear ? (
        <button type="button" onClick={onClear} aria-label="Remove filter" className="flex">
          <Icon name="close" className="text-[14px] hover:opacity-75" />
        </button>
      ) : null}
    </div>
  );
}

export function ListingControls({
  state,
  brands,
  filterCount,
  children,
}: {
  state: ListingState;
  brands: Brand[];
  filterCount: number;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(state);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v == null || v === "" ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const applyDraft = () => {
    update({
      brand: draft.brands.join(",") || null,
      min: draft.min != null ? String(draft.min) : null,
      max: draft.max != null ? String(draft.max) : null,
      stock: draft.inStock ? "1" : null,
      sale: draft.onSale ? "1" : null,
      rating: draft.rating ? String(draft.rating) : null,
      badge: draft.badge ?? null,
    });
    setFilterOpen(false);
  };

  const brandNames = state.brands.map((s) => brands.find((b) => b.slug === s)?.name ?? s).join(", ");
  const priceLabel =
    state.min != null || state.max != null
      ? state.min != null && state.max != null
        ? `Rs. ${formatNumber(state.min)} – ${formatNumber(state.max)}`
        : state.max != null
          ? `< Rs. ${formatNumber(state.max)}`
          : `> Rs. ${formatNumber(state.min)}`
      : null;

  return (
    <>
      <section className="sticky top-[60px] z-30 bg-surface/95 backdrop-blur-md px-margin pt-space-xs pb-space-sm flex flex-col gap-space-xs shadow-sm">
        <div className="flex items-center gap-space-sm w-full">
          <div className="flex-1 min-w-0">{children}</div>
          <button
            type="button"
            onClick={() => {
              setDraft(state);
              setFilterOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex-shrink-0 shadow-sm active:scale-95 transition-transform"
          >
            <Icon name="tune" className="text-[18px]" />
            <span>Filter{filterCount ? ` (${filterCount})` : ""}</span>
          </button>
        </div>
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1 -mx-margin px-margin text-nowrap">
          <Pill onClick={() => setSortOpen(true)}>
            <span className="text-secondary">Sort:</span>
            <span className="text-on-surface font-semibold">{SORT_LABELS[state.sort]}</span>
            <Icon name="keyboard_arrow_down" className="text-[16px] text-secondary" />
          </Pill>
          {brandNames ? (
            <Pill active onClear={() => update({ brand: null })} onClick={() => setFilterOpen(true)}>
              <span className="font-semibold">{brandNames}</span>
            </Pill>
          ) : null}
          {priceLabel ? (
            <Pill active onClear={() => update({ min: null, max: null })} onClick={() => setFilterOpen(true)}>
              <span className="font-semibold">{priceLabel}</span>
            </Pill>
          ) : null}
          <Pill active={state.badge === "PTA Approved"} onClick={() => update({ badge: state.badge === "PTA Approved" ? null : "PTA Approved" })}>
            <Icon name="verified" className="text-[16px] text-primary" />
            <span>PTA Approved</span>
          </Pill>
          <Pill active={state.onSale} onClick={() => update({ sale: state.onSale ? null : "1" })}>
            <Icon name="sell" className="text-[16px] text-primary" />
            <span>On Sale</span>
          </Pill>
          <Pill active={state.inStock} onClick={() => update({ stock: state.inStock ? null : "1" })}>
            <Icon name="inventory_2" className="text-[16px] text-primary" />
            <span>In Stock</span>
          </Pill>
          <Pill active={state.rating === 4} onClick={() => update({ rating: state.rating === 4 ? null : "4" })}>
            <Icon name="star" filled className="text-[16px] text-amber-500" />
            <span>4★ +</span>
          </Pill>
        </div>
        {pending ? <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary/60 animate-pulse" /> : null}
      </section>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <div className="flex flex-col">
          {(Object.keys(SORT_LABELS) as ListingState["sort"][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                update({ sort: k === "popular" ? null : k });
                setSortOpen(false);
              }}
              className="flex items-center justify-between py-3 font-body-md text-body-md text-on-surface border-b border-surface-container-low last:border-0"
            >
              {SORT_LABELS[k]}
              {state.sort === k ? <Icon name="check" className="text-primary text-[20px]" /> : null}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-label-lg text-label-lg mb-2">Price</p>
            <div className="flex flex-wrap gap-2">
              {PRICE_PRESETS.map((p) => {
                const active = draft.min === p.min && draft.max === p.max;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDraft({ ...draft, min: active ? undefined : p.min, max: active ? undefined : p.max })}
                    className={cn(
                      "px-3 py-1.5 rounded-full font-label-md text-label-md shadow-sm",
                      active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                inputMode="numeric"
                aria-label="Minimum price"
                placeholder="Min"
                value={draft.min ?? ""}
                onChange={(e) => setDraft({ ...draft, min: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-secondary">–</span>
              <input
                inputMode="numeric"
                aria-label="Maximum price"
                placeholder="Max"
                value={draft.max ?? ""}
                onChange={(e) => setDraft({ ...draft, max: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          {brands.length ? (
            <div>
              <p className="font-label-lg text-label-lg mb-2">Brands</p>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => {
                  const active = draft.brands.includes(b.slug);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDraft({ ...draft, brands: active ? draft.brands.filter((x) => x !== b.slug) : [...draft.brands, b.slug] })
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full font-label-md text-label-md shadow-sm",
                        active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface",
                      )}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            {[
              { key: "inStock" as const, label: "In stock only" },
              { key: "onSale" as const, label: "On sale" },
            ].map((o) => (
              <label key={o.key} className="flex items-center justify-between font-body-md text-body-md">
                {o.label}
                <input type="checkbox" className="w-5 h-5 accent-primary" checked={draft[o.key]} onChange={(e) => setDraft({ ...draft, [o.key]: e.target.checked })} />
              </label>
            ))}
            <label className="flex items-center justify-between font-body-md text-body-md">
              PTA Approved
              <input
                type="checkbox"
                className="w-5 h-5 accent-primary"
                checked={draft.badge === "PTA Approved"}
                onChange={(e) => setDraft({ ...draft, badge: e.target.checked ? "PTA Approved" : undefined })}
              />
            </label>
            <label className="flex items-center justify-between font-body-md text-body-md">
              Rated 4★ and above
              <input type="checkbox" className="w-5 h-5 accent-primary" checked={draft.rating === 4} onChange={(e) => setDraft({ ...draft, rating: e.target.checked ? 4 : undefined })} />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDraft({ ...draft, brands: [], min: undefined, max: undefined, inStock: false, onSale: false, rating: undefined, badge: undefined })}
            >
              Clear all
            </Button>
            <Button className="flex-1" onClick={applyDraft}>
              Show results
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export function ViewToggle({ view }: { view: "grid" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (v: "grid" | "list") => {
    const next = new URLSearchParams(params.toString());
    if (v === "grid") next.delete("view");
    else next.set("view", v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const btn = (active: boolean) =>
    cn("w-7 h-7 flex items-center justify-center rounded-md transition-colors", active ? "bg-surface-container-lowest text-primary shadow-sm" : "text-secondary hover:text-on-surface");
  return (
    <div className="flex items-center p-1 bg-surface-container rounded-lg gap-0.5 shadow-sm">
      <button type="button" aria-label="Grid view" aria-pressed={view === "grid"} className={btn(view === "grid")} onClick={() => set("grid")}>
        <Icon name="grid_view" className="text-[18px]" />
      </button>
      <button type="button" aria-label="List view" aria-pressed={view === "list"} className={btn(view === "list")} onClick={() => set("list")}>
        <Icon name="view_list" className="text-[18px]" />
      </button>
    </div>
  );
}

export function LoadMore({ page, shown, total }: { page: number; shown: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const pct = total ? Math.round((shown / total) * 1000) / 10 : 0;
  return (
    <section className="px-margin flex flex-col items-center gap-space-sm pb-space-lg">
      <div className="w-full flex flex-col items-center gap-1.5 max-w-xs">
        <div className="w-full flex justify-between font-label-sm text-label-sm text-secondary">
          <span>
            Showing {shown} of {total} items
          </span>
          <span className="font-semibold text-primary">{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {shown < total ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("page", String(page + 1));
            start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
          }}
          className="w-full max-w-md py-3.5 px-space-md rounded-xl bg-surface-container-lowest text-on-surface font-label-lg text-label-lg shadow-sm hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Icon name="cached" className={cn("text-[20px] text-secondary", pending && "animate-spin")} />
          <span>{pending ? "Loading…" : "Load More Products"}</span>
        </button>
      ) : null}
    </section>
  );
}
