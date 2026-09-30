import type { Metadata } from "next";
import { ApplyCouponButton } from "@/components/account/CopyCode";
import { StackHeader } from "@/components/layout/StackHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const { userId } = await requireUser("/account/coupons");
  const supabase = await getSupabaseServer();
  const [{ data: coupons }, { data: used }] = await Promise.all([
    supabase.from("coupons").select("*").eq("is_active", true).eq("is_public", true).order("created_at", { ascending: false }),
    supabase.from("coupon_redemptions").select("coupon_id").eq("user_id", userId),
  ]);
  const usedCount = new Map<string, number>();
  (used ?? []).forEach((u) => usedCount.set(u.coupon_id, (usedCount.get(u.coupon_id) ?? 0) + 1));

  return (
    <>
      <StackHeader title="My Coupons" fallbackHref="/account" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-sm">
        {(coupons as Coupon[] | null)?.length ? (
          (coupons as Coupon[]).map((c) => {
            const exhausted = (usedCount.get(c.id) ?? 0) >= c.per_user_limit;
            return (
              <div key={c.id} className={`bg-surface-container-lowest rounded-xl shadow-sm flex overflow-hidden ${exhausted ? "opacity-60" : ""}`}>
                <div className="w-24 shrink-0 bg-primary text-on-primary flex flex-col items-center justify-center p-2 text-center">
                  <span className="font-price-md text-price-md">{c.discount_type === "percent" ? `${Number(c.value)}%` : formatPKR(c.value).replace("Rs. ", "Rs.")}</span>
                  <span className="font-label-sm text-label-sm uppercase">off</span>
                </div>
                <div className="flex-1 p-space-sm flex flex-col gap-1 min-w-0">
                  <span className="font-label-lg text-label-lg tracking-wider">{c.code}</span>
                  <span className="font-body-sm text-body-sm text-secondary">{c.description}</span>
                  <span className="font-body-sm text-body-sm text-secondary">
                    Min. order {formatPKR(c.min_order_amount)}
                    {c.ends_at ? ` · Valid till ${formatDate(c.ends_at)}` : ""}
                  </span>
                </div>
                <div className="p-space-sm flex items-center">{exhausted ? <span className="font-label-md text-label-md text-secondary">Used</span> : <ApplyCouponButton code={c.code} />}</div>
              </div>
            );
          })
        ) : (
          <EmptyState icon="confirmation_number" title="No coupons right now" description="New vouchers and promotions will show up here." />
        )}
      </main>
    </>
  );
}
