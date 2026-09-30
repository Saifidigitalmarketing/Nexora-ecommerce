import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminPage } from "@/components/admin/ui";
import { getLookups } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProduct() {
  const { categories, brands, vendors } = await getLookups();
  return (
    <AdminPage title="Add product">
      <ProductForm
        categories={categories}
        brands={brands}
        vendors={vendors}
        initial={{
          name: "",
          slug: "",
          category_id: "",
          brand_id: "",
          vendor_id: vendors.find((v) => v.slug === "nexora-retail")?.id ?? vendors[0]?.id ?? "",
          short_description: "",
          description: "",
          price: "",
          compare_at_price: "",
          stock: "0",
          sku: "",
          badges: "",
          tags: "",
          is_active: true,
          is_featured: false,
          is_flash_deal: false,
          flash_deal_ends_at: "",
          specs: [],
          images: [],
          optionNames: "",
          variants: [],
        }}
      />
    </AdminPage>
  );
}
