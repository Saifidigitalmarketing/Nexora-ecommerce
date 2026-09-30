"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Pushed-screen header (Stitch product details): back · logo · title · actions. */
export function StackHeader({ title, actions, fallbackHref = "/" }: { title: string; actions?: ReactNode; fallbackHref?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 w-full z-50 pt-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 px-margin flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-space-sm min-w-0">
          <button
            type="button"
            aria-label="Go back"
            className="w-11 h-11 -ml-2 flex items-center justify-center text-on-surface hover:text-primary transition-colors"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
          >
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <img src="/brand/nexora-mark.svg" alt="" className="h-7 w-7 rounded-md" />
          <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-space-xs">{actions}</div>
      </div>
    </header>
  );
}
