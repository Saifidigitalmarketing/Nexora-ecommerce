import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminPage } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { getLookups } from "@/lib/admin-data";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Product, ProductImage, ProductVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Edit product" };

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data }, lookups] = await Promise.all([
    supabase.from("products").select("*, images:product_images(*), variants:product_variants(*)").eq("id", id).maybeSingle(),
    getLookups(),
  ]);
  if (!data) notFound();
  const p = data as Product & { images: ProductImage[]; variants: ProductVariant[] };
  const images = [...p.images].sort((a, b) => a.sort_order - b.sort_order);
  const variants = [...p.variants].sort((a, b) => a.sort_order - b.sort_order);
  const optionNames = [...new Set(variants.flatMap((v) => Object.keys(v.options ?? {})))];

  return (
    <AdminPage
      title="Edit product"
      subtitle={p.name}
      actions={
        <Link href="/admin/products" className="font-label-md text-label-md text-primary flex items-center gap-1">
          <Icon name="arrow_back" className="text-[18px]" /> All products
        </Link>
      }
    >
      <ProductForm
        {...lookups}
        initial={{
          id: p.id,
          name: p.name,
          slug: p.slug,
          category_id: p.category_id,
          brand_id: p.brand_id ?? "",
          vendor_id: p.vendor_id,
          short_description: p.short_description ?? "",
          description: p.description ?? "",
          price: String(p.price),
          compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : "",
          stock: String(p.stock),
          sku: p.sku ?? "",
          badges: p.badges.join(", "),
          tags: p.tags.join(", "),
          is_active: p.is_active,
          is_featured: p.is_featured,
          is_flash_deal: p.is_flash_deal,
          flash_deal_ends_at: toLocalInput(p.flash_deal_ends_at),
          specs: p.specs ?? [],
          images: images.map((i) => ({ id: i.id, url: i.url })),
          optionNames: optionNames.join(", "),
          variants: variants.map((v) => ({
            id: v.id,
            options: v.options ?? {},
            color_hex: v.color_hex ?? "",
            price: String(v.price),
            compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : "",
            stock: String(v.stock),
            sku: v.sku ?? "",
            is_active: v.is_active,
          })),
        }}
      />
    </AdminPage>
  );
}
