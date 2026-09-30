import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Brand } from "@/lib/types";

/** Circular monochrome brand badges ("Official Brand Flagships"). */
export function BrandRow({ brands }: { brands: Brand[] }) {
  return (
    <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-space-sm py-1">
      {brands.map((b) => (
        <Link key={b.id} href={`/search?brand=${b.slug}`} className="flex flex-col items-center gap-1 flex-shrink-0 group">
          <div className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
            {b.logo_url ? (
              <img src={b.logo_url} alt="" className="w-9 h-9 object-contain" />
            ) : b.icon ? (
              <Icon name={b.icon} className="text-[24px] text-on-surface" />
            ) : (
              <span className="font-label-sm text-label-sm font-bold text-on-surface tracking-tighter">{b.short_code ?? b.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <span className="font-label-sm text-label-sm text-on-surface font-medium">{b.name}</span>
        </Link>
      ))}
    </div>
  );
}
