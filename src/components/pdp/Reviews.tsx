import { Icon } from "@/components/ui/Icon";
import { formatDate, initials } from "@/lib/format";
import type { Review } from "@/lib/types";
import { ReviewForm } from "./ReviewForm";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" filled={i <= Math.round(rating)} style={{ fontSize: size }} />
      ))}
    </div>
  );
}

export function Reviews({ productId, slug, reviews, ratingAvg, ratingCount }: { productId: string; slug: string; reviews: Review[]; ratingAvg: number; ratingCount: number }) {
  return (
    <div className="flex flex-col px-margin mt-space-md" id="reviews">
      <div className="flex items-center justify-between mb-space-xs">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Verified Customer Reviews</h3>
        <span className="font-label-sm text-label-sm text-secondary">{ratingCount} Ratings</span>
      </div>
      {ratingCount > 0 ? (
        <div className="flex items-center gap-2 mb-space-sm">
          <span className="font-price-md text-price-md text-on-surface">{Number(ratingAvg).toFixed(1)}</span>
          <Stars rating={Number(ratingAvg)} />
        </div>
      ) : null}
      <div className="flex flex-col gap-space-sm">
        {reviews.map((r) => (
          <div key={r.id} className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-space-sm min-w-0">
                <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center font-label-lg text-label-lg text-primary font-bold shrink-0">
                  {initials(r.author_name)}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{r.author_name ?? "NEXORA Customer"}</span>
                    {r.is_verified_purchase ? <Icon name="check_circle" filled className="text-[14px] text-primary" label="Verified buyer" /> : null}
                  </div>
                  <span className="font-body-sm text-body-sm text-secondary">
                    {r.is_verified_purchase ? "Verified Buyer • " : ""}
                    {formatDate(r.created_at)}
                  </span>
                </div>
              </div>
              <Stars rating={r.rating} size={16} />
            </div>
            {r.title ? <p className="font-label-lg text-label-lg text-on-surface">{r.title}</p> : null}
            {r.body ? <p className="font-body-md text-body-md text-on-surface-variant">{r.body}</p> : null}
          </div>
        ))}
        {!reviews.length ? (
          <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm text-center font-body-md text-body-md text-secondary">
            No reviews yet. Be the first to review this product.
          </div>
        ) : null}
        <ReviewForm productId={productId} slug={slug} />
      </div>
    </div>
  );
}
