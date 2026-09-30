import { cn, discountPercent, formatNumber, formatPKR } from "@/lib/format";

export function Price({
  price,
  compareAt,
  size = "md",
  tone = "ink",
  stacked,
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  tone?: "ink" | "primary";
  stacked?: boolean;
  className?: string;
}) {
  const showCompare = compareAt != null && compareAt > price;
  const priceCls =
    size === "lg" ? "font-price-lg text-price-lg" : size === "sm" ? "font-label-lg text-label-lg font-bold" : "font-price-md text-price-md font-bold";
  return (
    <div className={cn(stacked ? "flex flex-col" : "flex items-baseline gap-1.5 flex-wrap", "tabular", className)}>
      <span className={cn(priceCls, tone === "primary" ? "text-primary" : "text-on-surface")}>{formatPKR(price)}</span>
      {showCompare ? (
        <span className="font-body-sm text-body-sm text-secondary line-through">
          {stacked ? formatPKR(compareAt) : formatNumber(compareAt)}
        </span>
      ) : null}
    </div>
  );
}

export function DiscountTag({ price, compareAt, className }: { price: number; compareAt?: number | null; className?: string }) {
  const pct = discountPercent(price, compareAt);
  if (!pct) return null;
  return (
    <span className={cn("px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[9px] font-bold", className)}>
      -{pct}%
    </span>
  );
}
