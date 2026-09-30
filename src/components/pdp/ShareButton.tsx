"use client";

import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

export function ShareButton({ title, className }: { title: string; className?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label="Share product"
      className={className ?? "w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:text-primary transition-colors"}
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            toast("Link copied");
          }
        } catch {
          /* user cancelled */
        }
      }}
    >
      <Icon name="ios_share" className="text-[20px]" />
    </button>
  );
}
