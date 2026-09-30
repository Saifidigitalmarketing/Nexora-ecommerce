import type { Metadata } from "next";
import { StackHeader } from "@/components/layout/StackHeader";
import { ProductGrid } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CARD_SELECT } from "@/lib/catalog";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ProductCardData } from "@/lib/types";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("wishlist_items")
    .select(`created_at, product:products(${CARD_SELECT})`)
    .order("created_at", { ascending: false });
  const products = ((data ?? []) as unknown as { product: ProductCardData | null }[])
    .map((r) => r.product)
    .filter((p): p is ProductCardData => !!p && p.is_active);
  products.forEach((p) => p.images.sort((a, b) => a.sort_order - b.sort_order));

  return (
    <>
      <StackHeader title="My Wishlist" fallbackHref="/account" />
      <main className="w-full max-w-screen-xl mx-auto px-margin py-space-md pb-24">
        {products.length ? (
          <>
            <p className="font-body-sm text-body-sm text-secondary mb-space-sm">{products.length} saved items</p>
            <ProductGrid products={products} />
          </>
        ) : (
          <EmptyState
            icon="favorite"
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it for later."
            action={<ButtonLink href="/">Discover products</ButtonLink>}
          />
        )}
      </main>
    </>
  );
}
