import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCategories } from "@/lib/catalog";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  const top = categories.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col w-full pb-8">
      <section className="px-margin pt-space-sm pb-space-xs">
        <SearchBar placeholder="Search in all categories..." />
      </section>
      <section className="px-margin mt-space-sm">
        <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight mb-space-sm">All Categories</h1>
        {top.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-sm">
            {top.map((c) => {
              const subs = categories.filter((s) => s.parent_id === c.id);
              return (
                <div key={c.id} className="rounded-xl bg-surface-container-lowest shadow-sm p-space-sm flex flex-col gap-space-sm">
                  <Link href={`/categories/${c.slug}`} className="group flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <Icon name={c.icon ?? "category"} className="text-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-lg text-label-lg text-on-surface">{c.name}</p>
                      <p className="font-body-sm text-body-sm text-secondary">{subs.length ? `${subs.length} subcategories` : "Shop all"}</p>
                    </div>
                    <Icon name="chevron_right" className="text-[20px] text-secondary" />
                  </Link>
                  {subs.length ? (
                    <div className="flex flex-wrap gap-space-xs">
                      {subs.map((s) => (
                        <Link
                          key={s.id}
                          href={`/categories/${s.slug}`}
                          className="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
                        >
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="category" title="No categories yet" description="Categories added by the admin will appear here." />
        )}
      </section>
    </div>
  );
}
