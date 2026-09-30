"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Brand, Category, ProductSpec, Vendor } from "@/lib/types";
import { Card } from "./ui";
import { ImageManager, type EditableImage } from "./ImageManager";

export interface ProductFormValue {
  id?: string;
  name: string;
  slug: string;
  category_id: string;
  brand_id: string;
  vendor_id: string;
  short_description: string;
  description: string;
  price: string;
  compare_at_price: string;
  stock: string;
  sku: string;
  badges: string;
  tags: string;
  is_active: boolean;
  is_featured: boolean;
  is_flash_deal: boolean;
  flash_deal_ends_at: string;
  specs: ProductSpec[];
  images: EditableImage[];
  optionNames: string;
  variants: VariantRow[];
}

export interface VariantRow {
  id?: string;
  options: Record<string, string>;
  color_hex: string;
  price: string;
  compare_at_price: string;
  stock: string;
  sku: string;
  is_active: boolean;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const BADGE_SUGGESTIONS = ["PTA Approved", "Official Warranty", "Bestseller", "New Drop", "COD Available", "Express 24h", "18M Warranty"];

export function ProductForm({ initial, categories, brands, vendors }: { initial: ProductFormValue; categories: Category[]; brands: Brand[]; vendors: Vendor[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<ProductFormValue>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const optionNames = useMemo(() => v.optionNames.split(",").map((s) => s.trim()).filter(Boolean), [v.optionNames]);
  const hasVariants = v.variants.length > 0;

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const tops = categories.filter((c) => !c.parent_id);

  const validate = () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Name is required";
    if (!/^[a-z0-9-]{2,80}$/.test(v.slug)) e.slug = "Use lowercase letters, numbers and dashes";
    if (!v.category_id) e.category_id = "Choose a category";
    if (!v.vendor_id) e.vendor_id = "Choose a store";
    if (!(Number(v.price) >= 0) || v.price === "") e.price = "Enter a price";
    if (v.compare_at_price && Number(v.compare_at_price) <= Number(v.price)) e.compare_at_price = "Must be higher than price (or empty)";
    if (!hasVariants && !(Number(v.stock) >= 0)) e.stock = "Enter stock";
    if (v.is_flash_deal && !v.flash_deal_ends_at) e.flash_deal_ends_at = "Set when the deal ends";
    v.variants.forEach((row, i) => {
      if (optionNames.some((n) => !row.options[n]?.trim())) e[`variant_${i}`] = "Fill every option value";
      if (!(Number(row.price) >= 0) || row.price === "") e[`variant_${i}`] = "Variant price required";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast("Please fix the highlighted fields", "error");
      return;
    }
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const row = {
      name: v.name.trim(),
      slug: v.slug,
      category_id: v.category_id,
      brand_id: v.brand_id || null,
      vendor_id: v.vendor_id,
      short_description: v.short_description.trim() || null,
      description: v.description.trim() || null,
      price: Number(v.price),
      compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
      stock: hasVariants ? 0 : Math.max(0, Math.floor(Number(v.stock))),
      sku: v.sku.trim() || null,
      badges: v.badges.split(",").map((s) => s.trim()).filter(Boolean),
      tags: v.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      specs: v.specs.filter((s) => s.label.trim() && s.value.trim()),
      is_active: v.is_active,
      is_featured: v.is_featured,
      is_flash_deal: v.is_flash_deal,
      flash_deal_ends_at: v.is_flash_deal && v.flash_deal_ends_at ? new Date(v.flash_deal_ends_at).toISOString() : null,
      flash_deal_stock_total: v.is_flash_deal ? null : null,
    };

    const res = v.id ? await supabase.from("products").update(row).eq("id", v.id).select("id").single() : await supabase.from("products").insert(row).select("id").single();
    if (res.error || !res.data) {
      setSaving(false);
      toast(res.error?.message.includes("products_slug_key") ? "That URL slug is already used" : (res.error?.message ?? "Save failed"), "error");
      return;
    }
    const productId = res.data.id as string;

    // Images: replace the set in order
    const keepIds = v.images.filter((i) => i.id).map((i) => i.id as string);
    const del = supabase.from("product_images").delete().eq("product_id", productId);
    const { error: delErr } = keepIds.length ? await del.not("id", "in", `(${keepIds.join(",")})`) : await del;
    if (delErr) toast(delErr.message, "error");
    for (const [i, img] of v.images.entries()) {
      if (img.id) await supabase.from("product_images").update({ sort_order: i }).eq("id", img.id);
      else await supabase.from("product_images").insert({ product_id: productId, url: img.url, alt: row.name, sort_order: i });
    }

    // Variants
    const keepVariantIds = v.variants.filter((r) => r.id).map((r) => r.id as string);
    const delV = supabase.from("product_variants").delete().eq("product_id", productId);
    const { error: delVErr } = keepVariantIds.length ? await delV.not("id", "in", `(${keepVariantIds.join(",")})`) : await delV;
    if (delVErr) toast(`Some variants are in orders and could not be removed — deactivate them instead`, "error");
    for (const [i, r] of v.variants.entries()) {
      const vr = {
        product_id: productId,
        label: optionNames.map((n) => r.options[n]).join(" / "),
        options: Object.fromEntries(optionNames.map((n) => [n, r.options[n]?.trim() ?? ""])),
        color_hex: r.color_hex.trim() || null,
        price: Number(r.price),
        compare_at_price: r.compare_at_price ? Number(r.compare_at_price) : null,
        stock: Math.max(0, Math.floor(Number(r.stock) || 0)),
        sku: r.sku.trim() || null,
        sort_order: i,
        is_active: r.is_active,
      };
      const { error } = r.id ? await supabase.from("product_variants").update(vr).eq("id", r.id) : await supabase.from("product_variants").insert(vr);
      if (error) toast(error.message, "error");
    }
    // flash deal "claimed" baseline = stock when the deal is saved
    if (v.is_flash_deal) {
      const { data: fresh } = await supabase.from("products").select("stock").eq("id", productId).single();
      await supabase.from("products").update({ flash_deal_stock_total: Math.max(1, fresh?.stock ?? 1) }).eq("id", productId);
    }

    setSaving(false);
    toast("Product saved");
    if (!v.id) router.replace(`/admin/products/${productId}`);
    else router.refresh();
  };

  const remove = async () => {
    if (!v.id || !confirm("Delete this product permanently? Past orders keep their snapshot. Consider deactivating instead.")) return;
    const { error } = await getSupabaseBrowser().from("products").delete().eq("id", v.id);
    if (error) toast(error.message, "error");
    else {
      toast("Product deleted");
      router.replace("/admin/products");
      router.refresh();
    }
  };

  const addVariant = () =>
    set("variants", [...v.variants, { options: Object.fromEntries(optionNames.map((n) => [n, ""])), color_hex: "", price: v.price, compare_at_price: v.compare_at_price, stock: "0", sku: "", is_active: true }]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md items-start">
      <div className="lg:col-span-2 flex flex-col gap-space-md">
        <Card title="Basic information">
          <div className="flex flex-col gap-3">
            <Input
              label="Product name"
              name="name"
              value={v.name}
              error={errors.name}
              onChange={(e) => {
                const name = e.target.value;
                setV((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }));
              }}
            />
            <Input
              label="URL slug"
              name="slug"
              value={v.slug}
              error={errors.slug}
              hint={`nexora.pk/product/${v.slug || "…"}`}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
            <Input label="Short description" optional name="short_description" value={v.short_description} maxLength={160} onChange={(e) => set("short_description", e.target.value)} />
            <Textarea label="Description" optional name="description" value={v.description} rows={6} onChange={(e) => set("description", e.target.value)} />
          </div>
        </Card>

        <Card title="Images">
          <ImageManager images={v.images} onChange={(imgs) => set("images", imgs)} />
        </Card>

        <Card title="Pricing & stock">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Price (Rs.)" name="price" inputMode="decimal" value={v.price} error={errors.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} />
            <Input label="Compare-at (Rs.)" optional name="compare_at_price" inputMode="decimal" value={v.compare_at_price} error={errors.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value.replace(/[^\d.]/g, ""))} />
            <Input
              label="Stock"
              name="stock"
              inputMode="numeric"
              value={hasVariants ? "" : v.stock}
              disabled={hasVariants}
              placeholder={hasVariants ? "From variants" : ""}
              error={errors.stock}
              onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))}
            />
            <Input label="SKU" optional name="sku" value={v.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
        </Card>

        <Card title="Variants" actions={<span className="font-body-sm text-body-sm text-secondary">Optional — e.g. colour, size, storage</span>}>
          <div className="flex flex-col gap-3">
            <Input
              label="Option names (comma separated)"
              name="optionNames"
              placeholder="e.g. Finish, Storage   or   Size"
              value={v.optionNames}
              onChange={(e) => set("optionNames", e.target.value)}
            />
            {v.variants.map((r, i) => (
              <div key={r.id ?? i} className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {optionNames.map((n) => (
                    <Input
                      key={n}
                      label={n}
                      name={`v${i}_${n}`}
                      value={r.options[n] ?? ""}
                      onChange={(e) => {
                        const next = [...v.variants];
                        next[i] = { ...r, options: { ...r.options, [n]: e.target.value } };
                        set("variants", next);
                      }}
                    />
                  ))}
                  <Input label="Colour hex" optional name={`v${i}_hex`} placeholder="#9c9589" value={r.color_hex} onChange={(e) => { const next = [...v.variants]; next[i] = { ...r, color_hex: e.target.value }; set("variants", next); }} />
                  <Input label="Price" name={`v${i}_price`} inputMode="decimal" value={r.price} onChange={(e) => { const next = [...v.variants]; next[i] = { ...r, price: e.target.value.replace(/[^\d.]/g, "") }; set("variants", next); }} />
                  <Input label="Compare-at" optional name={`v${i}_cmp`} inputMode="decimal" value={r.compare_at_price} onChange={(e) => { const next = [...v.variants]; next[i] = { ...r, compare_at_price: e.target.value.replace(/[^\d.]/g, "") }; set("variants", next); }} />
                  <Input label="Stock" name={`v${i}_stock`} inputMode="numeric" value={r.stock} onChange={(e) => { const next = [...v.variants]; next[i] = { ...r, stock: e.target.value.replace(/\D/g, "") }; set("variants", next); }} />
                </div>
                {errors[`variant_${i}`] ? <p className="font-body-sm text-body-sm text-error">{errors[`variant_${i}`]}</p> : null}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-body-sm text-body-sm">
                    <input type="checkbox" className="accent-primary" checked={r.is_active} onChange={(e) => { const next = [...v.variants]; next[i] = { ...r, is_active: e.target.checked }; set("variants", next); }} /> Active
                  </label>
                  <button type="button" onClick={() => set("variants", v.variants.filter((_, k) => k !== i))} className="font-label-md text-label-md text-error flex items-center gap-1">
                    <Icon name="delete" className="text-[16px]" /> Remove
                  </button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addVariant} disabled={!optionNames.length}>
              <Icon name="add" className="text-[18px]" /> Add variant
            </Button>
          </div>
        </Card>

        <Card title="Key specifications">
          <div className="flex flex-col gap-2">
            {v.specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <Input label={i === 0 ? "Label" : undefined} name={`spec_l${i}`} placeholder="Processor" value={s.label} onChange={(e) => { const n = [...v.specs]; n[i] = { ...s, label: e.target.value }; set("specs", n); }} />
                <Input label={i === 0 ? "Value" : undefined} name={`spec_v${i}`} placeholder="A18 Pro" value={s.value} onChange={(e) => { const n = [...v.specs]; n[i] = { ...s, value: e.target.value }; set("specs", n); }} />
                <Input label={i === 0 ? "Detail" : undefined} name={`spec_d${i}`} placeholder="6-core CPU" value={s.detail ?? ""} onChange={(e) => { const n = [...v.specs]; n[i] = { ...s, detail: e.target.value }; set("specs", n); }} />
                <button type="button" aria-label="Remove spec" onClick={() => set("specs", v.specs.filter((_, k) => k !== i))} className="w-10 h-10 rounded-lg hover:bg-error-container text-secondary hover:text-error flex items-center justify-center">
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
            <Button variant="outline" onClick={() => set("specs", [...v.specs, { label: "", value: "", detail: "" }])}>
              <Icon name="add" className="text-[18px]" /> Add specification
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-space-md lg:sticky lg:top-4">
        <Card title="Organisation">
          <div className="flex flex-col gap-3">
            <Select label="Category" name="category_id" value={v.category_id} error={errors.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Select…</option>
              {tops.map((t) => (
                <optgroup key={t.id} label={t.name}>
                  <option value={t.id}>{t.name} (all)</option>
                  {categories
                    .filter((c) => c.parent_id === t.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
            <Select label="Brand" optional name="brand_id" value={v.brand_id} onChange={(e) => set("brand_id", e.target.value)}>
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select label="Store (vendor)" name="vendor_id" value={v.vendor_id} error={errors.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}>
              <option value="">Select…</option>
              {vendors.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input label="Badges (comma separated)" optional name="badges" value={v.badges} onChange={(e) => set("badges", e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {BADGE_SUGGESTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set("badges", v.badges.includes(b) ? v.badges : [v.badges, b].filter(Boolean).join(", "))}
                  className="px-2 py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm hover:bg-surface-container"
                >
                  + {b}
                </button>
              ))}
            </div>
            <Input label="Search tags (comma separated)" optional name="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} hint="Extra words shoppers may search for" />
          </div>
        </Card>
        <Card title="Visibility">
          <div className="flex flex-col gap-3 font-body-md text-body-md">
            <label className="flex items-center justify-between">
              Active (visible in store)
              <input type="checkbox" className="w-5 h-5 accent-primary" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              Featured on home
              <input type="checkbox" className="w-5 h-5 accent-primary" checked={v.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              Flash deal
              <input type="checkbox" className="w-5 h-5 accent-primary" checked={v.is_flash_deal} onChange={(e) => set("is_flash_deal", e.target.checked)} />
            </label>
            {v.is_flash_deal ? (
              <Input label="Deal ends at" name="flash_deal_ends_at" type="datetime-local" value={v.flash_deal_ends_at} error={errors.flash_deal_ends_at} onChange={(e) => set("flash_deal_ends_at", e.target.value)} />
            ) : null}
          </div>
        </Card>
        <Button size="lg" loading={saving} onClick={() => void save()}>
          <Icon name="save" className="text-[18px]" /> {v.id ? "Save changes" : "Create product"}
        </Button>
        {v.id ? (
          <div className="grid grid-cols-2 gap-2">
            <a href={`/product/${v.slug}`} target="_blank" rel="noopener noreferrer" className="h-11 rounded-lg bg-surface-container flex items-center justify-center gap-1 font-label-lg text-label-lg">
              <Icon name="open_in_new" className="text-[18px]" /> View
            </a>
            <Button variant="outline" className="text-error" onClick={() => void remove()}>
              <Icon name="delete" className="text-[18px]" /> Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
