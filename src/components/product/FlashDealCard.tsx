import Link from "next/link";
import { Price } from "@/components/ui/Price";
import { discountPercent } from "@/lib/format";
import type { ProductCardData } from "@/lib/types";
import { ProductImage } from "./ProductImage";

/** Horizontal flash-deal card with "Claimed" progress (Stitch home). */
export function FlashDealCard({ product }: { product: ProductCardData }) {
  const total = product.flash_deal_stock_total ?? 0;
  const claimed = total > 0 ? Math.min(100, Math.max(0, Math.round(((total - product.stock) / total) * 100))) : 0;
  const pct = discountPercent(Number(product.price), product.compare_at_price);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex-shrink-0 w-44 rounded-xl bg-surface-container-lowest shadow-sm p-space-sm flex flex-col justify-between"
    >
      <div>
        <div className="relative w-full aspect-square rounded-lg bg-surface-container-low overflow-hidden mb-2">
          <ProductImage src={product.images[0]?.url} alt={product.name} className="w-full h-full object-contain p-2" />
          {pct ? (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[9px] font-bold">
              -{pct}%
            </span>
          ) : null}
        </div>
        {product.brand ? <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block">{product.brand.name}</span> : null}
        <h3 className="font-body-md text-body-md text-on-surface font-medium line-clamp-1 mt-0.5">{product.name}</h3>
        <Price price={Number(product.price)} compareAt={product.compare_at_price} tone="primary" className="mt-1" />
      </div>
      <div className="mt-3">
        <div className="flex justify-between items-center text-label-sm font-label-sm text-secondary mb-1">
          <span>{product.stock > 0 ? "Claimed" : "Sold out"}</span>
          <span className="text-on-surface font-semibold">{claimed}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${claimed}%` }} />
        </div>
      </div>
    </Link>
  );
}
