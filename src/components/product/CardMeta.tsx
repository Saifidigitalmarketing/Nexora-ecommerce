import { Icon } from "@/components/ui/Icon";
import { discountPercent, formatCount, formatNumber, formatPKR } from "@/lib/format";

/** Rs. 54,999  68,000  -19%  — price line used on every product card. */
export function CardPrice({ price, compareAt }: { price: number; compareAt: number | null }) {
  const pct = discountPercent(price, compareAt);
  return (
    <div className="tabular">
      <p className="font-price-md text-price-md text-primary font-bold leading-tight">{formatPKR(price)}</p>
      {pct ? (
        <p className="flex items-center gap-1.5 font-body-sm text-body-sm mt-0.5">
          <span className="text-secondary line-through">{formatNumber(compareAt)}</span>
          <span className="text-on-surface font-semibold">-{pct}%</span>
        </p>
      ) : null}
    </div>
  );
}

/** ★★★★☆ (51) — shown only when the product has real reviews. */
export function CardRating({ avg, count }: { avg: number; count: number }) {
  if (!count) return null;
  const full = Math.round(Number(avg));
  return (
    <div className="flex items-center gap-1 mt-1" aria-label={`Rated ${Number(avg).toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="flex text-amber-500">
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" filled={i <= full} className={`text-[13px] ${i <= full ? "" : "text-outline-variant"}`} />
        ))}
      </span>
      <span className="font-label-sm text-label-sm text-secondary">({formatCount(count)})</span>
    </div>
  );
}
