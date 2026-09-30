"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

/** Status tabs + search box that write to the URL. */
export function FilterBar({ tabs, param = "status", placeholder = "Search…" }: { tabs?: { value: string; label: string }[]; param?: string; placeholder?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const current = params.get(param) ?? "";
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.delete("page");
    return `${pathname}?${next.toString()}`;
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {tabs ? (
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={href({ [param]: t.value || null })}
              className={cn(
                "px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap",
                current === t.value ? "bg-on-surface text-surface" : "bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-low",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : (
        <span />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(href({ q: q.trim() || null }));
        }}
        className="flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 shadow-sm sm:w-72"
      >
        <Icon name="search" className="text-[18px] text-secondary mr-2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search" className="bg-transparent outline-none w-full font-body-md text-body-md" />
      </form>
    </div>
  );
}
