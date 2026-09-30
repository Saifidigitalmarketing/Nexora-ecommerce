import type { Metadata } from "next";
import { AddressBook } from "@/components/account/AddressBook";
import { StackHeader } from "@/components/layout/StackHeader";
import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Saved Addresses" };

export default async function AddressesPage() {
  const { userId } = await requireUser("/account/addresses");
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at");
  return (
    <>
      <StackHeader title="Saved Addresses" fallbackHref="/account" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md">
        <AddressBook addresses={(data ?? []) as Address[]} userId={userId} />
      </main>
    </>
  );
}
