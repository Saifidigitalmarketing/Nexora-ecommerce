import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function SectionHeader({ title, subtitle, href, extra }: { title: string; subtitle?: string; href?: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-space-sm gap-2">
      <div className="flex items-center gap-space-sm min-w-0">
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">{title}</h2>
          {subtitle ? <p className="font-body-sm text-body-sm text-secondary">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      {href ? (
        <Link className="font-label-md text-label-md text-primary font-semibold flex items-center gap-0.5 hover:underline shrink-0" href={href}>
          <span>View All</span>
          <Icon name="chevron_right" className="text-[16px]" />
        </Link>
      ) : null}
    </div>
  );
}
