import type { Metadata } from "next";
import { DeliverySettingsForm, type DeliverySettings } from "@/components/admin/DeliverySettingsForm";
import { ZonesManager, type Zone } from "@/components/admin/sections";
import { AdminPage, Card } from "@/components/admin/ui";
import { PROVINCES } from "@/lib/pakistan";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Delivery Charges" };

export default async function AdminDelivery() {
  const supabase = await getSupabaseServer();
  const [{ data: settings }, { data: zones }] = await Promise.all([
    supabase.from("delivery_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("delivery_zones").select("*").order("province").order("priority", { ascending: false }),
  ]);
  const initial: DeliverySettings = settings ?? { mode: "area", base_charge: 250, eta_min_days: 3, eta_max_days: 5, free_delivery_enabled: false, free_delivery_threshold: null };
  return (
    <AdminPage title="Delivery Charges" subtitle="Rules live in the database (calculate_delivery) and apply to both the storefront and order placement.">
      <Card title="Settings">
        <DeliverySettingsForm initial={initial} />
      </Card>
      <Card title="Zones" actions={<span className="font-body-sm text-body-sm text-secondary">Most specific match wins: area → city → province</span>}>
        <ZonesManager rows={(zones ?? []) as Zone[]} provinces={PROVINCES.map((p) => p.name)} />
      </Card>
    </AdminPage>
  );
}
