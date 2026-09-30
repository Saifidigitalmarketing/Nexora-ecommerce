import type { Metadata } from "next";
import { BrandsManager, VendorsManager } from "@/components/admin/sections";
import { AdminPage, Card } from "@/components/admin/ui";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Brand, Vendor } from "@/lib/types";

export const metadata: Metadata = { title: "Brands & Stores" };

export default async function AdminBrands() {
  const supabase = await getSupabaseServer();
  const [{ data: brands }, { data: vendors }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("vendors").select("*").order("name"),
  ]);
  return (
    <AdminPage title="Brands & Stores" subtitle="Brands describe who makes a product. Stores (vendors) are who sells it — ready for multi-vendor later.">
      <Card title="Brands">
        <BrandsManager rows={(brands ?? []) as Brand[]} />
      </Card>
      <Card title="Stores">
        <VendorsManager rows={(vendors ?? []) as Vendor[]} />
      </Card>
    </AdminPage>
  );
}
