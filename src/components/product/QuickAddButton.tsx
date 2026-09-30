"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/ui/Toast";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/format";

/** Round "+" button from the Stitch cards. Products with options open the product page. */
export function QuickAddButton({ product, className }: { product: ProductCardData; className?: string }) {
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const soldOut = product.stock <= 0;

  return (
    <button
      type="button"
      title={soldOut ? "Sold out" : hasVariants ? "Choose options" : "Add to Cart"}
      aria-label={soldOut ? `${product.name} is sold out` : hasVariants ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
      disabled={soldOut}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasVariants) {
          router.push(`/product/${product.slug}`);
          return;
        }
        add({
          productId: product.id,
          variantId: null,
          name: product.name,
          slug: product.slug,
          image: product.images[0]?.url ?? null,
          price: Number(product.price),
          compareAt: product.compare_at_price != null ? Number(product.compare_at_price) : null,
          variantLabel: null,
          vendor: product.vendor ? { name: product.vendor.name, slug: product.vendor.slug, badge: product.vendor.badge } : null,
          maxStock: product.stock,
        });
        setDone(true);
        toast("Added to cart");
        setTimeout(() => setDone(false), 1200);
      }}
      className={cn(
        "w-8 h-8 rounded-full text-on-primary flex items-center justify-center shadow-sm active:scale-90 transition-all shrink-0 disabled:bg-outline-variant",
        done ? "bg-tertiary-container" : "bg-primary hover:bg-tertiary",
        className,
      )}
    >
      <Icon name={done ? "check" : hasVariants ? "tune" : "add"} className="text-[18px]" />
    </button>
  );
}
