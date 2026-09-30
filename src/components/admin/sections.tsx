"use client";

import { Icon } from "@/components/ui/Icon";
import { formatDate, formatPKR } from "@/lib/format";
import type { Banner, Brand, Category, Coupon, Vendor } from "@/lib/types";
import { RecordManager } from "./RecordManager";

const pill = (on: boolean, yes = "Active", no = "Inactive") => (
  <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${on ? "bg-primary/10 text-primary" : "bg-surface-container-high text-secondary"}`}>{on ? yes : no}</span>
);

export function CategoriesManager({ rows }: { rows: Category[] }) {
  const parents = rows.filter((c) => !c.parent_id);
  const name = (id: string | null) => rows.find((c) => c.id === id)?.name;
  const sorted = [...parents].flatMap((p) => [p, ...rows.filter((c) => c.parent_id === p.id)]);
  return (
    <RecordManager
      table="categories"
      title="Category"
      rows={sorted}
      defaults={{ is_active: true, sort_order: 0 }}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "slug", label: "URL slug", required: true, hint: "lowercase-with-dashes" },
        { name: "parent_id", label: "Parent category", type: "select", nullable: true, options: parents.map((p) => ({ value: p.id, label: p.name })), hint: "Leave empty for a top-level category" },
        { name: "icon", label: "Icon", placeholder: "devices", hint: "Material Symbols name, e.g. devices, styler, chair, spa" },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        {
          label: "Category",
          render: (c) => (
            <span className={`flex items-center gap-2 ${c.parent_id ? "pl-6" : "font-semibold"}`}>
              <Icon name={c.icon ?? "category"} className="text-[18px] text-primary" /> {c.name}
            </span>
          ),
        },
        { label: "Slug", render: (c) => <span className="text-secondary">{c.slug}</span> },
        { label: "Parent", render: (c) => name(c.parent_id) ?? "—" },
        { label: "Order", render: (c) => c.sort_order },
        { label: "Status", render: (c) => pill(c.is_active) },
      ]}
    />
  );
}

export function BrandsManager({ rows }: { rows: Brand[] }) {
  return (
    <RecordManager
      table="brands"
      title="Brand"
      rows={rows}
      defaults={{ is_featured: false, sort_order: 0 }}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "slug", label: "URL slug", required: true },
        { name: "logo_url", label: "Logo URL", nullable: true },
        { name: "icon", label: "Icon (if no logo)", nullable: true, placeholder: "phone_iphone" },
        { name: "short_code", label: "Monogram (if no logo/icon)", nullable: true, placeholder: "KH" },
        { name: "is_featured", label: "Show in Official Brand Flagships", type: "checkbox" },
        { name: "sort_order", label: "Sort order", type: "number" },
      ]}
      columns={[
        { label: "Brand", render: (b) => <span className="font-semibold">{b.name}</span> },
        { label: "Slug", render: (b) => <span className="text-secondary">{b.slug}</span> },
        { label: "Home", render: (b) => pill(b.is_featured, "Featured", "—") },
        { label: "Order", render: (b) => b.sort_order },
      ]}
    />
  );
}

export function VendorsManager({ rows }: { rows: Vendor[] }) {
  return (
    <RecordManager
      table="vendors"
      title="Store"
      rows={rows}
      defaults={{ is_active: true, is_official: true }}
      fields={[
        { name: "name", label: "Store name", required: true },
        { name: "slug", label: "URL slug", required: true },
        { name: "badge", label: "Badge", nullable: true, placeholder: "PTA Approved" },
        { name: "logo_url", label: "Logo URL", nullable: true },
        { name: "is_official", label: "Official store", type: "checkbox" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        { label: "Store", render: (v) => <span className="font-semibold">{v.name}</span> },
        { label: "Badge", render: (v) => v.badge ?? "—" },
        { label: "Official", render: (v) => pill(v.is_official, "Official", "—") },
        { label: "Status", render: (v) => pill(v.is_active) },
      ]}
    />
  );
}

export function CouponsManager({ rows }: { rows: Coupon[] }) {
  return (
    <RecordManager
      table="coupons"
      title="Coupon"
      rows={rows}
      defaults={{ discount_type: "fixed", is_active: true, is_public: true, per_user_limit: 1, min_order_amount: 0 }}
      fields={[
        { name: "code", label: "Code", type: "upper", required: true, placeholder: "EID2026" },
        { name: "description", label: "Description", nullable: true },
        { name: "discount_type", label: "Type", type: "select", required: true, options: [{ value: "fixed", label: "Fixed amount (Rs.)" }, { value: "percent", label: "Percentage (%)" }] },
        { name: "value", label: "Value", type: "number", required: true },
        { name: "min_order_amount", label: "Minimum order (Rs.)", type: "number", required: true },
        { name: "max_discount", label: "Max discount (Rs.) for % coupons", type: "number", nullable: true },
        { name: "starts_at", label: "Starts", type: "datetime", nullable: true },
        { name: "ends_at", label: "Ends", type: "datetime", nullable: true },
        { name: "usage_limit", label: "Total usage limit", type: "number", nullable: true },
        { name: "per_user_limit", label: "Uses per customer", type: "number", required: true },
        { name: "is_public", label: "Show in customers' Coupons page", type: "checkbox" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        { label: "Code", render: (c) => <span className="font-label-lg text-label-lg tracking-wider">{c.code}</span> },
        { label: "Discount", render: (c) => (c.discount_type === "percent" ? `${Number(c.value)}%${c.max_discount ? ` (max ${formatPKR(c.max_discount)})` : ""}` : formatPKR(c.value)) },
        { label: "Min order", render: (c) => formatPKR(c.min_order_amount) },
        { label: "Used", render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ""}` },
        { label: "Ends", render: (c) => (c.ends_at ? formatDate(c.ends_at) : "—") },
        { label: "Status", render: (c) => pill(c.is_active) },
      ]}
    />
  );
}

export interface Zone {
  id: string;
  name: string;
  province: string;
  city: string | null;
  area: string | null;
  charge: number;
  eta_min_days: number;
  eta_max_days: number;
  priority: number;
  is_active: boolean;
}

export function ZonesManager({ rows, provinces }: { rows: Zone[]; provinces: string[] }) {
  return (
    <RecordManager
      table="delivery_zones"
      title="Zone"
      rows={rows}
      defaults={{ is_active: true, priority: 0, eta_min_days: 1, eta_max_days: 3 }}
      fields={[
        { name: "name", label: "Zone name", required: true, placeholder: "Karachi Metro" },
        { name: "province", label: "Province", type: "select", required: true, options: provinces.map((p) => ({ value: p, label: p })) },
        { name: "city", label: "City", nullable: true, hint: "Empty = whole province" },
        { name: "area", label: "Area", nullable: true, hint: "Empty = whole city. Must match the area customers type." },
        { name: "charge", label: "Charge (Rs.)", type: "number", required: true },
        { name: "eta_min_days", label: "ETA min days", type: "number", required: true },
        { name: "eta_max_days", label: "ETA max days", type: "number", required: true },
        { name: "priority", label: "Priority (tie-breaker)", type: "number" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        { label: "Zone", render: (z) => <span className="font-semibold">{z.name}</span> },
        { label: "Covers", render: (z) => [z.area, z.city, z.province].filter(Boolean).join(", ") },
        { label: "Charge", render: (z) => (Number(z.charge) === 0 ? "FREE" : formatPKR(z.charge)) },
        { label: "ETA", render: (z) => `${z.eta_min_days}–${z.eta_max_days} days` },
        { label: "Status", render: (z) => pill(z.is_active) },
      ]}
    />
  );
}

export function BannersManager({ rows }: { rows: Banner[] }) {
  return (
    <RecordManager
      table="banners"
      title="Banner"
      rows={rows as (Banner & { is_active?: boolean; sort_order?: number })[]}
      defaults={{ is_active: true, sort_order: 0, cta_label: "Shop Now" }}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "subtitle", label: "Subtitle", nullable: true },
        { name: "badge", label: "Badge", nullable: true, placeholder: "Curated Editorial" },
        { name: "image_url", label: "Image URL", nullable: true, hint: "Wide image, e.g. 1200×600" },
        { name: "cta_label", label: "Button label", nullable: true },
        { name: "cta_link", label: "Button link", nullable: true, placeholder: "/categories/apparel" },
        { name: "starts_at", label: "Starts", type: "datetime", nullable: true },
        { name: "ends_at", label: "Ends", type: "datetime", nullable: true },
        { name: "sort_order", label: "Sort order", type: "number" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        { label: "Banner", render: (b) => <span className="font-semibold">{b.title}</span> },
        { label: "Link", render: (b) => <span className="text-secondary">{b.cta_link ?? "—"}</span> },
        { label: "Status", render: (b) => pill(Boolean((b as { is_active?: boolean }).is_active)) },
      ]}
    />
  );
}
