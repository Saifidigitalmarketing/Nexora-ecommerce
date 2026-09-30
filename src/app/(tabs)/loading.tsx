import { ProductGridSkeleton } from "@/components/product/ProductCard";

export default function Loading() {
  return (
    <div className="px-margin pt-space-sm flex flex-col gap-space-md">
      <div className="h-12 rounded-full bg-surface-container-lowest shadow-sm animate-pulse" />
      <div className="h-[200px] rounded-xl bg-surface-container-low animate-pulse" />
      <ProductGridSkeleton count={4} />
    </div>
  );
}
