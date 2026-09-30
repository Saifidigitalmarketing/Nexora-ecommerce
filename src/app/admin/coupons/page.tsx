import type { Metadata } from "next";
import { CouponsManager } from "@/components/admin/sections";
import { AdminPage, Card } from "@/components/admin/ui";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCoupons() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  return (
    <AdminPage title="Coupons" subtitle="Vouchers are validated in the database at checkout (limits, dates, minimum order).">
      <Card>
        <CouponsManager rows={(data ?? []) as Coupon[]} />
      </Card>
    </AdminPage>
  );
}
