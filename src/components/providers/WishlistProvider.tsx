"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "./AuthProvider";

interface WishlistState {
  ids: Set<string>;
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistState>({ ids: new Set(), has: () => false, toggle: async () => {} });

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    getSupabaseBrowser()
      .from("wishlist_items")
      .select("product_id")
      .then(({ data }) => {
        if (!cancelled && data) setIds(new Set(data.map((r) => r.product_id as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!userId) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const supabase = getSupabaseBrowser();
      const had = ids.has(productId);
      setIds((prev) => {
        const next = new Set(prev);
        if (had) next.delete(productId);
        else next.add(productId);
        return next;
      });
      const { error } = had
        ? await supabase.from("wishlist_items").delete().eq("product_id", productId).eq("user_id", userId)
        : await supabase.from("wishlist_items").insert({ user_id: userId, product_id: productId });
      if (error) {
        setIds((prev) => {
          const next = new Set(prev);
          if (had) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast("Could not update wishlist", "error");
      } else {
        toast(had ? "Removed from wishlist" : "Saved to wishlist");
      }
    },
    [userId, ids, router, pathname, toast],
  );

  const value = useMemo(() => ({ ids, has: (id: string) => ids.has(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  return useContext(WishlistContext);
}
