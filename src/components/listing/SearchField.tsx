"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Compact search input used in the sticky results header (Stitch search screen). */
export function SearchField({ defaultValue = "", placeholder = "Search products, brands, models..." }: { defaultValue?: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValue);
  useEffect(() => setQ(defaultValue), [defaultValue]);

  const submit = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
      className="flex items-center bg-surface-container-low rounded-xl px-3 py-2.5 shadow-sm transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md"
    >
      <Icon name="search" className="text-[20px] text-primary mr-2 flex-shrink-0" />
      <input
        type="search"
        enterKeyHint="search"
        aria-label="Search products"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-0 outline-none w-full font-body-md text-body-md text-on-surface placeholder:text-secondary p-0 min-w-0"
      />
      {q ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            submit("");
          }}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-container text-secondary hover:text-on-surface hover:bg-surface-container-highest transition-colors flex-shrink-0"
        >
          <Icon name="close" className="text-[16px]" />
        </button>
      ) : null}
    </form>
  );
}
