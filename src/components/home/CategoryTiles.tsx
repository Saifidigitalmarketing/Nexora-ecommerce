import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/lib/types";

/** 4-column icon tile grid (Stitch home). */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-space-sm">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/categories/${c.slug}`}
          className="group flex flex-col items-center p-2 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all text-center"
        >
          <div className="w-11 h-11 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <Icon name={c.icon ?? "category"} className="text-[22px]" />
          </div>
          <span className="mt-2 font-label-sm text-label-sm text-on-surface line-clamp-1 font-medium">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}
