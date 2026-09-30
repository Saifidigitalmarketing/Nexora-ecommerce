"use client";

import { Icon } from "@/components/ui/Icon";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { cn } from "@/lib/format";

export function WishlistButton({ productId, className, size = "sm" }: { productId: string; className?: string; size?: "sm" | "md" }) {
  const { has, toggle } = useWishlist();
  const active = has(productId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from Wishlist" : "Add to Wishlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(productId);
      }}
      className={cn(
        "rounded-full backdrop-blur-sm flex items-center justify-center transition-colors",
        size === "md" ? "w-9 h-9 bg-surface-container" : "w-7 h-7 bg-surface-container-lowest/80",
        active ? "text-error" : "text-on-surface hover:text-error",
        className,
      )}
    >
      <Icon name="favorite" filled={active} className={size === "md" ? "text-[20px]" : "text-[16px]"} />
    </button>
  );
}
