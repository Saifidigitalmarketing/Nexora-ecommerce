import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar } from "@/components/admin/FilterBar";
import { InventoryTable, type InventoryRow } from "@/components/admin/InventoryTable";
import { AdminPage, Card } from "@/components/admin/ui";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventory({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  let req = supabase.from("products").select("id, name, sku, stock, variants:product_variants(id, label, sku, stock, is_active, sort_order)").order("name").limit(500);
  if (sp.q) req = req.ilike("name", `%${sp.q.replace(/[%,()*]/g, " ").trim()}%`);
  const { data } = await req;
  type P = { id: string; name: string; sku: string | null; stock: number; variants: { id: string; label: string; sku: string | null; stock: number; is_active: boolean; sort_order: number }[] };
  let rows: InventoryRow[] = ((data ?? []) as P[]).flatMap((p): InventoryRow[] =>
    p.variants.length
      ? [...p.variants]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ key: v.id, table: "product_variants" as const, id: v.id, productId: p.id, name: p.name, label: v.label, sku: v.sku, stock: v.stock }))
      : [{ key: p.id, table: "products" as const, id: p.id, productId: p.id, name: p.name, label: null, sku: p.sku, stock: p.stock }],
  );
  if (sp.low) rows = rows.filter((r) => r.stock <= 5);
  return (
    <AdminPage title="Inventory" subtitle="Edit stock per product or per variant. Orders reserve stock automatically; cancellations return it.">
      <Suspense>
        <FilterBar
          param="low"
          placeholder="Search products"
          tabs={[
            { value: "", label: "All" },
            { value: "1", label: "Low stock (≤ 5)" },
          ]}
        />
      </Suspense>
      <Card>
        <InventoryTable rows={rows} />
        {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">Nothing to show.</p> : null}
      </Card>
    </AdminPage>
  );
}
