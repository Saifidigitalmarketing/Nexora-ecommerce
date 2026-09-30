import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { formatCount } from "@/lib/format";
import type { ProductCardData } from "@/lib/types";
import { ProductImage } from "@/components/product/ProductImage";
import { QuickAddButton } from "@/components/product/QuickAddButton";
import { WishlistButton } from "@/components/product/WishlistButton";

/** Search-results card (Stitch search screen) — used for grid and list views. */
export function ResultCard({ product, layout }: { product: ProductCardData; layout: "grid" | "list" }) {
  const badge = product.badges[0];
  const list = layout === "list";
  return (
    <Link
      href={`/product/${product.slug}`}
      className={`flex ${list ? "flex-row" : "flex-col"} bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group`}
    >
      <div className={`relative ${list ? "w-32 shrink-0" : "w-full"} aspect-square bg-surface-container-low flex items-center justify-center overflow-hidden`}>
        <ProductImage src={product.images[0]?.url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {badge ? (
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-bold tracking-tight">{badge}</span>
          </div>
        ) : null}
        <WishlistButton productId={product.id} className="absolute top-2 right-2" />
      </div>
      <div className="p-3 flex flex-col flex-1 justify-between gap-2 min-w-0">
        <div>
          {product.rating_count > 0 ? (
            <div className="flex items-center gap-1 mb-1">
              <Icon name="star" filled className="text-[14px] text-amber-500" />
              <span className="font-label-md text-label-md font-bold text-on-surface">{Number(product.rating_avg).toFixed(1)}</span>
              <span className="font-body-sm text-body-sm text-secondary">({formatCount(product.rating_count)})</span>
            </div>
          ) : product.brand ? (
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-1">{product.brand.name}</span>
          ) : null}
          <h3 className="font-label-lg text-label-lg text-on-surface line-clamp-2 leading-tight">{product.name}</h3>
          {list && product.short_description ? (
            <p className="font-body-sm text-body-sm text-secondary line-clamp-2 mt-1">{product.short_description}</p>
          ) : null}
        </div>
        <div className="flex items-end justify-between pt-1 gap-1">
          <Price price={Number(product.price)} compareAt={product.compare_at_price} tone="primary" stacked />
          <QuickAddButton product={product} />
        </div>
      </div>
    </Link>
  );
}
