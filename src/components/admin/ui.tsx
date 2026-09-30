import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

export function AdminPage({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-space-md p-margin lg:p-space-xl max-w-7xl w-full mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
          {subtitle ? <p className="font-body-md text-body-md text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 max-w-full">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high/60", className)}>
      {title ? (
        <div className="flex items-center justify-between px-space-md pt-space-md pb-2">
          <h2 className="font-label-lg text-label-lg font-bold text-on-surface">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={title ? "px-space-md pb-space-md" : "p-space-md"}>{children}</div>
    </section>
  );
}

export function StatCard({ icon, label, value, hint, href }: { icon: string; label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high/60 p-space-md flex items-start gap-3 h-full">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon name={icon} className="text-[22px]" />
      </div>
      <div className="min-w-0">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{label}</p>
        <p className="font-price-md text-price-md text-on-surface tabular">{value}</p>
        {hint ? <p className="font-body-sm text-body-sm text-secondary">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Responsive table: horizontal scroll on small screens. */
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-space-md">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-surface-container-high">
            {head.map((h) => (
              <th key={h} className="px-space-md py-2 font-label-sm text-label-sm uppercase tracking-wider text-secondary whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-low font-body-md text-body-md">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-space-md py-2.5 align-middle", className)}>{children}</td>;
}

export function Pager({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 font-label-md text-label-md text-secondary">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container">
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
