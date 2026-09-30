import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Brand, Category, Vendor } from "@/lib/types";

export async function getLookups() {
  const supabase = await getSupabaseServer();
  const [{ data: categories }, { data: brands }, { data: vendors }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("brands").select("*").order("name"),
    supabase.from("vendors").select("*").order("name"),
  ]);
  return { categories: (categories ?? []) as Category[], brands: (brands ?? []) as Brand[], vendors: (vendors ?? []) as Vendor[] };
}
