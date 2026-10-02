import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/listing/ProductListing";
import type { RawParams } from "@/components/listing/params";
import { SearchField } from "@/components/listing/SearchField";
import { Icon } from "@/components/ui/Icon";
import { getCategories } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found", robots: { index: false } };
  const parent = cat.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  return pageMetadata({
    title: cat.name,
    description: `Shop ${cat.name}${parent ? ` in ${parent.name}` : ""} on NEXORA — authentic products with Cash on Delivery, Easypaisa and JazzCash across Pakistan.`,
    path: `/categories/${cat.slug}`,
    images: cat.image_url ? [{ url: cat.image_url, alt: cat.name }] : undefined,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const parent = category.parent_id ? categories.find((c) => c.id === category.parent_id) : null;
  const root = parent ?? category;
  const subs = categories.filter((c) => c.parent_id === root.id);
  // a parent category lists its own products plus all subcategories
  const ids = category.parent_id ? [category.id] : [category.id, ...categories.filter((c) => c.parent_id === category.id).map((c) => c.id)];
  const q = typeof sp.q === "string" ? sp.q : "";

  return (
    <div className="flex flex-col w-full">
      <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs px-margin pt-space-sm font-label-md text-label-md">
        <Link href="/categories" className="text-secondary hover:text-primary">
          Categories
        </Link>
        {parent ? (
          <>
            <Icon name="chevron_right" className="text-[14px] text-outline" />
            <Link href={`/categories/${parent.slug}`} className="text-secondary hover:text-primary">
              {parent.name}
            </Link>
          </>
        ) : null}
        <Icon name="chevron_right" className="text-[14px] text-outline" />
        <span className="text-on-surface truncate">{category.name}</span>
      </nav>
      <div className="px-margin pt-space-xs pb-space-sm flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Icon name={category.icon ?? "category"} className="text-[20px]" />
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">{category.name}</h1>
      </div>
      {subs.length ? (
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar px-margin pb-space-sm">
          <Link
            href={`/categories/${root.slug}`}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full font-label-md text-label-md shadow-sm",
              category.id === root.id ? "bg-on-surface text-surface" : "bg-surface-container-lowest text-on-surface",
            )}
          >
            All {root.name}
          </Link>
          {subs.map((s) => (
            <Link
              key={s.id}
              href={`/categories/${s.slug}`}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full font-label-md text-label-md shadow-sm",
                s.id === category.id ? "bg-on-surface text-surface" : "bg-surface-container-lowest text-on-surface",
              )}
            >
              {s.name}
            </Link>
          ))}
        </div>
      ) : null}
      <ProductListing searchParams={sp} categoryIds={ids} context={category.name} searchSlot={<SearchField defaultValue={q} placeholder={`Search in ${category.name}...`} />} />
    </div>
  );
}
