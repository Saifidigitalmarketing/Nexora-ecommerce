import Link from "next/link";
import type { ProductCardData } from "@/lib/types";
import { CardPrice, CardRating } from "./CardMeta";
import { ProductImage } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";

const BADGE_STYLE: Record<string, string> = {
  "PTA Approved": "bg-primary-fixed text-on-primary-fixed",
  "Official Warranty": "bg-primary-fixed text-on-primary-fixed",
  Bestseller: "bg-secondary-container text-on-secondary-container",
  "New Drop": "bg-surface-tint/10 text-primary",
};

/**
 * Product card: the whole card opens the product page (options, Add to Cart
 * and Buy Now live there). Image, 2-line name, price with discount, rating.
 */
export function ProductCard({ product, priority, layout = "grid" }: { product: ProductCardData; priority?: boolean; layout?: "grid" | "list" }) {
  const badge = product.badges[0];
  const list = layout === "list";
  return (
    <Link
      href={`/product/${product.slug}`}
      aria-label={product.name}
      className={`group relative flex ${list ? "flex-row" : "flex-col"} bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.99] transition-all`}
    >
      <div className={`relative ${list ? "w-32 shrink-0" : "w-full"} aspect-square bg-surface-container-low overflow-hidden`}>
        <ProductImage
          src={product.images[0]?.url}
          alt={product.name}
          eager={priority}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <WishlistButton productId={product.id} className="absolute top-2 right-2" />
        {badge ? (
          <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded font-label-sm text-[9px] font-bold ${BADGE_STYLE[badge] ?? "bg-surface-container-high text-on-surface-variant"}`}>
            {badge}
          </span>
        ) : null}
        {product.stock <= 0 ? (
          <div className="absolute inset-0 bg-surface-container-lowest/60 flex items-center justify-center">
            <span className="px-2 py-1 rounded-full bg-on-surface text-surface font-label-sm text-label-sm">Sold out</span>
          </div>
        ) : null}
      </div>
      <div className="p-2.5 flex flex-col flex-1 min-w-0">
        <h3 className="font-body-md text-body-md text-on-surface line-clamp-2 leading-snug min-h-[2.75em]">{product.name}</h3>
        {list && product.short_description ? <p className="font-body-sm text-body-sm text-secondary line-clamp-2 mt-1">{product.short_description}</p> : null}
        <div className="mt-1.5">
          <CardPrice price={Number(product.price)} compareAt={product.compare_at_price != null ? Number(product.compare_at_price) : null} />
          <CardRating avg={Number(product.rating_avg)} count={product.rating_count} />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-container-lowest shadow-sm p-space-sm animate-pulse">
          <div className="aspect-square rounded-lg bg-surface-container-low mb-2" />
          <div className="h-2.5 w-12 rounded bg-surface-container mb-2" />
          <div className="h-3.5 w-full rounded bg-surface-container mb-1" />
          <div className="h-3.5 w-2/3 rounded bg-surface-container mb-4" />
          <div className="h-5 w-20 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  );
}
