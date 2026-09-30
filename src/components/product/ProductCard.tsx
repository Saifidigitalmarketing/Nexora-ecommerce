import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { discountPercent, formatCount } from "@/lib/format";
import type { ProductCardData } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { QuickAddButton } from "./QuickAddButton";
import { WishlistButton } from "./WishlistButton";

const BADGE_STYLE: Record<string, string> = {
  "PTA Approved": "bg-primary-fixed text-on-primary-fixed",
  "Official Warranty": "bg-primary-fixed text-on-primary-fixed",
  Bestseller: "bg-secondary-container text-on-secondary-container",
  "New Drop": "bg-surface-tint/10 text-primary",
};

/** Recommended-for-you card (Stitch home, 2-column grid). */
export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const badge = product.badges[0];
  const pct = discountPercent(Number(product.price), product.compare_at_price);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col justify-between rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow p-space-sm"
    >
      <div>
        <div className="relative w-full aspect-square rounded-lg bg-surface-container-low overflow-hidden mb-2">
          <ProductImage
            src={product.images[0]?.url}
            alt={product.name}
            eager={priority}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
          />
          <WishlistButton productId={product.id} className="absolute top-2 right-2" />
          {pct ? (
            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[9px] font-bold">
              -{pct}%
            </span>
          ) : null}
          {badge ? (
            <div
              className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded font-label-sm text-[9px] font-bold ${BADGE_STYLE[badge] ?? "bg-surface-container-high text-on-surface-variant"}`}
            >
              {badge}
            </div>
          ) : null}
          {product.stock <= 0 ? (
            <div className="absolute inset-0 bg-surface-container-lowest/60 flex items-center justify-center">
              <span className="px-2 py-1 rounded-full bg-on-surface text-surface font-label-sm text-label-sm">Sold out</span>
            </div>
          ) : null}
        </div>
        {product.brand ? (
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block">{product.brand.name}</span>
        ) : null}
        <h3 className="font-body-md text-body-md text-on-surface font-medium line-clamp-2 mt-0.5 leading-snug">{product.name}</h3>
        {product.rating_count > 0 ? (
          <div className="flex items-center gap-1 mt-1">
            <Icon name="star" filled className="text-[14px] text-amber-500" />
            <span className="font-label-sm text-label-sm font-semibold text-on-surface">{Number(product.rating_avg).toFixed(1)}</span>
            <span className="font-label-sm text-label-sm text-secondary">({formatCount(product.rating_count)})</span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 pt-2 flex items-center justify-between gap-1">
        <Price price={Number(product.price)} compareAt={product.compare_at_price} stacked />
        <QuickAddButton product={product} />
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-space-sm lg:gap-gutter">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-space-sm lg:gap-gutter" aria-hidden>
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
