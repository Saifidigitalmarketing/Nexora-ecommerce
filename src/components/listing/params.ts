import type { ProductQuery, SortKey } from "@/lib/catalog";

export type RawParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 12;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined;
const num = (v: string | undefined) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export interface ListingState {
  q?: string;
  brands: string[];
  store?: string;
  min?: number;
  max?: number;
  sort: SortKey;
  inStock: boolean;
  onSale: boolean;
  rating?: number;
  badge?: string;
  featured: boolean;
  flash: boolean;
  page: number;
  view: "grid" | "list";
}

const SORTS: SortKey[] = ["popular", "newest", "price_asc", "price_desc", "rating"];

export function parseListing(sp: RawParams): ListingState {
  const sort = one(sp.sort) as SortKey | undefined;
  return {
    q: one(sp.q)?.slice(0, 80) || undefined,
    store: one(sp.store) || undefined,
    brands: (one(sp.brand) ?? "").split(",").filter(Boolean).slice(0, 20),
    min: num(one(sp.min)),
    max: num(one(sp.max)),
    sort: sort && SORTS.includes(sort) ? sort : "popular",
    inStock: one(sp.stock) === "1",
    onSale: one(sp.sale) === "1",
    rating: num(one(sp.rating)),
    badge: one(sp.badge) || undefined,
    featured: one(sp.featured) === "1",
    flash: one(sp.flash) === "1",
    page: Math.min(20, Math.max(1, num(one(sp.page)) ?? 1)),
    view: one(sp.view) === "list" ? "list" : "grid",
  };
}

export function toQuery(s: ListingState, categoryIds?: string[]): ProductQuery {
  return {
    q: s.q,
    brandSlugs: s.brands,
    vendorSlug: s.store,
    minPrice: s.min,
    maxPrice: s.max,
    sort: s.sort,
    inStock: s.inStock,
    onSale: s.onSale,
    minRating: s.rating,
    badge: s.badge,
    featured: s.featured,
    flash: s.flash,
    categoryIds,
    limit: PAGE_SIZE * s.page,
    offset: 0,
  };
}

/** Number of active refinement filters (for the "Filter (n)" button). */
export function activeFilterCount(s: ListingState): number {
  return (
    (s.brands.length ? 1 : 0) +
    (s.min != null || s.max != null ? 1 : 0) +
    (s.inStock ? 1 : 0) +
    (s.onSale ? 1 : 0) +
    (s.rating ? 1 : 0) +
    (s.badge ? 1 : 0)
  );
}
