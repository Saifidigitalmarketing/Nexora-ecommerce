import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { StackHeader } from "@/components/layout/StackHeader";
import { requireUser } from "@/lib/auth";
import { getPublicSetting } from "@/lib/catalog";
import type { PaymentAccounts } from "@/lib/payments";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const { userId, profile } = await requireUser("/checkout");
  const supabase = await getSupabaseServer();
  const [{ data: addresses }, accounts] = await Promise.all([
    supabase.from("addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at"),
    getPublicSetting<PaymentAccounts>("payment_accounts", {}),
  ]);
  return (
    <>
      <StackHeader title="Checkout" fallbackHref="/cart" />
      <main className="flex-1 bg-surface">
        <CheckoutView profile={profile} addresses={(addresses ?? []) as Address[]} accounts={accounts} />
      </main>
    </>
  );
}
