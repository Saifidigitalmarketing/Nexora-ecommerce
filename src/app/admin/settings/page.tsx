import type { Metadata } from "next";
import { BannersManager } from "@/components/admin/sections";
import { StoreSettingsForm, type StoreInfo } from "@/components/admin/StoreSettingsForm";
import { AdminPage, Card } from "@/components/admin/ui";
import type { PaymentAccounts } from "@/lib/payments";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Banner } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettings() {
  const supabase = await getSupabaseServer();
  const [{ data: settings }, { data: banners }] = await Promise.all([
    supabase.from("store_settings").select("key, value"),
    supabase.from("banners").select("*").order("sort_order"),
  ]);
  const get = <T,>(k: string, d: T) => ((settings ?? []).find((s) => s.key === k)?.value as T) ?? d;
  return (
    <AdminPage title="Settings" subtitle="Store information, payment accounts and home page content.">
      <Card title="Store">
        <StoreSettingsForm store={get<StoreInfo>("store", {})} accounts={get<PaymentAccounts>("payment_accounts", {})} trending={get<string[]>("trending_searches", [])} />
      </Card>
      <Card title="Home banners">
        <BannersManager rows={(banners ?? []) as Banner[]} />
      </Card>
    </AdminPage>
  );
}
