import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/sections";
import { AdminPage, Card } from "@/components/admin/ui";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategories() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <AdminPage title="Categories" subtitle="Top-level categories appear as home tiles; subcategories appear as chips.">
      <Card>
        <CategoriesManager rows={(data ?? []) as Category[]} />
      </Card>
    </AdminPage>
  );
}
