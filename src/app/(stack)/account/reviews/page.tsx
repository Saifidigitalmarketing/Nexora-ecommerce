import type { Metadata } from "next";
import Link from "next/link";
import { DeleteReviewButton } from "@/components/account/DeleteReviewButton";
import { StackHeader } from "@/components/layout/StackHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Reviews" };

export default async function MyReviewsPage() {
  const { userId } = await requireUser("/account/reviews");
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, created_at, is_approved, product:products(name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const reviews = (data ?? []) as unknown as { id: string; rating: number; title: string | null; body: string | null; created_at: string; is_approved: boolean; product: { name: string; slug: string } | null }[];

  return (
    <>
      <StackHeader title="My Reviews" fallbackHref="/account" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-sm">
        {reviews.length ? (
          reviews.map((r) => (
            <div key={r.id} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                {r.product ? (
                  <Link href={`/product/${r.product.slug}#reviews`} className="font-label-lg text-label-lg text-on-surface hover:text-primary line-clamp-1">
                    {r.product.name}
                  </Link>
                ) : (
                  <span />
                )}
                <DeleteReviewButton id={r.id} />
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon key={i} name="star" filled={i <= r.rating} className="text-[16px]" />
                ))}
                <span className="font-body-sm text-body-sm text-secondary ml-1">{formatDate(r.created_at)}</span>
                {!r.is_approved ? <span className="font-label-sm text-label-sm text-secondary ml-1">· Hidden by moderator</span> : null}
              </div>
              {r.title ? <p className="font-label-md text-label-md">{r.title}</p> : null}
              {r.body ? <p className="font-body-md text-body-md text-on-surface-variant">{r.body}</p> : null}
            </div>
          ))
        ) : (
          <EmptyState icon="rate_review" title="No reviews yet" description="Review products you've bought to help other shoppers." />
        )}
      </main>
    </>
  );
}
