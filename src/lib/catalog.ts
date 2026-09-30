import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Banner, Brand, Category, ProductCardData, ProductDetail, Review } from "@/lib/types";

/** Columns needed to render a product card. */
export const CARD_SELECT =
  "*, brand:brands(name, slug), vendor:vendors(name, slug, badge), images:product_images(id, url, alt, sort_order), variants:product_variants(id)";

function sortImages<T extends { images: { sort_order: number }[] }>(rows: T[]): T[] {
  rows.forEach((r) => r.images?.sort((a, b) => a.sort_order - b.sort_order));
  return rows;
}

export type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

export interface ProductQuery {
  q?: string;
  categoryIds?: string[];
  brandSlugs?: string[];
  vendorSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  minRating?: number;
  badge?: string;
  featured?: boolean;
  flash?: boolean;
  sort?: SortKey;
  limit?: number;
  offset?: number;
  excludeId?: string;
}

/** Escape user input for a PostgREST ilike filter inside or(). */
function ilikeTerm(q: string): string {
  return `%${q.replace(/[%_,()*\\]/g, " ").trim()}%`;
}

export async function listProducts(query: ProductQuery = {}): Promise<{ items: ProductCardData[]; total: number }> {
  const supabase = await getSupabaseServer();
  let req = supabase.from("products").select(CARD_SELECT, { count: "exact" }).eq("is_active", true);

  if (query.q) {
    const term = ilikeTerm(query.q);
    // match brand names too
    const { data: brandHits } = await supabase.from("brands").select("id").ilike("name", term);
    const brandIds = (brandHits ?? []).map((b) => b.id);
    const ors = [`name.ilike.${term}`, `short_description.ilike.${term}`];
    if (brandIds.length) ors.push(`brand_id.in.(${brandIds.join(",")})`);
    const words = query.q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[^a-z0-9.]/g, ""));
    if (words.length) ors.push(`tags.ov.{${words.join(",")}}`);
    req = req.or(ors.join(","));
  }
  if (query.categoryIds?.length) req = req.in("category_id", query.categoryIds);
  if (query.brandSlugs?.length) {
    const { data: brands } = await supabase.from("brands").select("id").in("slug", query.brandSlugs);
    req = req.in("brand_id", (brands ?? []).map((b) => b.id).concat("00000000-0000-0000-0000-000000000000"));
  }
  if (query.vendorSlug) {
    const { data: vendor } = await supabase.from("vendors").select("id").eq("slug", query.vendorSlug).maybeSingle();
    req = req.eq("vendor_id", vendor?.id ?? "00000000-0000-0000-0000-000000000000");
  }
  if (query.minPrice != null) req = req.gte("price", query.minPrice);
  if (query.maxPrice != null) req = req.lte("price", query.maxPrice);
  if (query.inStock) req = req.gt("stock", 0);
  if (query.onSale) req = req.not("compare_at_price", "is", null);
  if (query.minRating) req = req.gte("rating_avg", query.minRating);
  if (query.badge) req = req.contains("badges", [query.badge]);
  if (query.featured) req = req.eq("is_featured", true);
  if (query.flash) req = req.eq("is_flash_deal", true).gt("flash_deal_ends_at", new Date().toISOString());
  if (query.excludeId) req = req.neq("id", query.excludeId);

  switch (query.sort ?? "popular") {
    case "newest":
      req = req.order("created_at", { ascending: false });
      break;
    case "price_asc":
      req = req.order("price", { ascending: true });
      break;
    case "price_desc":
      req = req.order("price", { ascending: false });
      break;
    case "rating":
      req = req.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false });
      break;
    default:
      req = req.order("sold_count", { ascending: false }).order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  }

  const limit = query.limit ?? 24;
  const offset = query.offset ?? 0;
  req = req.range(offset, offset + limit - 1);

  const { data, count, error } = await req;
  if (error) throw new Error(error.message);
  return { items: sortImages((data ?? []) as ProductCardData[]), total: count ?? 0 };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, brand:brands(name, slug), vendor:vendors(name, slug, badge), category:categories(id, name, slug, parent_id), images:product_images(id, url, alt, sort_order), variants:product_variants(*)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const p = data as ProductDetail;
  p.images.sort((a, b) => a.sort_order - b.sort_order);
  p.variants = p.variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
  return p;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export async function getFeaturedBrands(): Promise<Brand[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("brands").select("*").eq("is_featured", true).order("sort_order");
  return (data ?? []) as Brand[];
}

export async function getBrands(): Promise<Brand[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("brands").select("*").order("sort_order");
  return (data ?? []) as Brand[];
}

export async function getActiveBanners(): Promise<Banner[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("banners").select("*").order("sort_order");
  return (data ?? []) as Banner[];
}

export async function getProductReviews(productId: string, limit = 10): Promise<Review[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Review[];
}

export async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("store_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
