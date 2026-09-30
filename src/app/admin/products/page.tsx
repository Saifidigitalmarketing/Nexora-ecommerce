import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminPage, Card, Pager, Table, Td } from "@/components/admin/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products" };
const PAGE = 25;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const supabase = await getSupabaseServer();
  let req = supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, stock, is_active, is_featured, is_flash_deal, sold_count, category:categories(name), brand:brands(name), images:product_images(url, sort_order)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.q) req = req.ilike("name", `%${sp.q.replace(/[%,()*]/g, " ").trim()}%`);
  if (sp.status === "active") req = req.eq("is_active", true);
  if (sp.status === "hidden") req = req.eq("is_active", false);
  if (sp.status === "flash") req = req.eq("is_flash_deal", true);
  if (sp.status === "out") req = req.eq("stock", 0);
  const { data, count } = await req;
  type Row = { id: string; name: string; slug: string; price: number; compare_at_price: number | null; stock: number; is_active: boolean; is_featured: boolean; is_flash_deal: boolean; sold_count: number; category: { name: string } | null; brand: { name: string } | null; images: { url: string; sort_order: number }[] };
  const rows = (data ?? []) as unknown as Row[];
  const qs = (p: number) => `/admin/products?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;

  return (
    <AdminPage
      title="Products"
      subtitle={`${count ?? 0} products in the catalogue`}
      actions={
        <ButtonLink href="/admin/products/new">
          <Icon name="add" className="text-[18px]" /> Add product
        </ButtonLink>
      }
    >
      <Suspense>
        <FilterBar
          placeholder="Search products"
          tabs={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "hidden", label: "Hidden" },
            { value: "flash", label: "Flash deals" },
            { value: "out", label: "Out of stock" },
          ]}
        />
      </Suspense>
      <Card>
        <Table head={["Product", "Category", "Price", "Stock", "Sold", "Status"]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface-container-low/50">
              <Td>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden shrink-0">
                    <ProductImage src={[...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-lg text-label-lg text-on-surface hover:text-primary line-clamp-1">{p.name}</p>
                    <p className="font-body-sm text-body-sm text-secondary">{p.brand?.name ?? "—"}</p>
                  </div>
                </Link>
              </Td>
              <Td className="text-secondary">{p.category?.name}</Td>
              <Td className="tabular whitespace-nowrap">
                {formatPKR(p.price)}
                {p.compare_at_price ? <span className="block font-body-sm text-body-sm text-secondary line-through">{formatPKR(p.compare_at_price)}</span> : null}
              </Td>
              <Td className={p.stock === 0 ? "text-error font-semibold" : p.stock <= 5 ? "text-error" : ""}>{p.stock}</Td>
              <Td>{p.sold_count}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${p.is_active ? "bg-primary/10 text-primary" : "bg-surface-container-high text-secondary"}`}>{p.is_active ? "Active" : "Hidden"}</span>
                  {p.is_featured ? <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-container text-on-secondary-container">Featured</span> : null}
                  {p.is_flash_deal ? <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-error-container text-on-error-container">Flash</span> : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No products found.</p> : null}
        <Pager page={page} total={count ?? 0} pageSize={PAGE} hrefFor={qs} />
      </Card>
    </AdminPage>
  );
}
