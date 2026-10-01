import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardData } from "@/lib/types";

/** Search/category result card — same card as the home page, grid or list. */
export function ResultCard({ product, layout }: { product: ProductCardData; layout: "grid" | "list" }) {
  return <ProductCard product={product} layout={layout} />;
}
