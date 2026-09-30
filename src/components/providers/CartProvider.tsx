"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  compareAt: number | null;
  variantLabel: string | null;
  vendor: { name: string; slug: string; badge: string | null } | null;
  maxStock: number;
  selected: boolean;
  /** set when a refresh finds the item unavailable */
  unavailable?: boolean;
}

export type NewCartItem = Omit<CartItem, "key" | "quantity" | "selected"> & { quantity?: number };

interface CartState {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (item: NewCartItem) => void;
  setQuantity: (key: string, qty: number) => void;
  remove: (key: string) => void;
  toggleSelected: (key: string, selected: boolean) => void;
  setAllSelected: (selected: boolean) => void;
  replace: (items: CartItem[]) => void;
  clearSelected: () => void;
  clear: () => void;
}

const STORAGE_KEY = "nx_cart_v1";
const MAX_QTY = 20;
const CartContext = createContext<CartState | null>(null);

export const cartKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* storage unavailable */
    }
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setItems(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: NewCartItem) => {
    setItems((list) => {
      const key = cartKey(item.productId, item.variantId);
      const limit = Math.max(0, Math.min(MAX_QTY, item.maxStock));
      const existing = list.find((i) => i.key === key);
      if (existing) {
        return list.map((i) =>
          i.key === key ? { ...i, ...item, key, selected: true, quantity: Math.min(limit, i.quantity + (item.quantity ?? 1)) } : i,
        );
      }
      return [...list, { ...item, key, selected: true, quantity: Math.min(limit, item.quantity ?? 1) }];
    });
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items,
      ready,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add,
      setQuantity: (key, qty) =>
        setItems((list) => list.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(qty, MAX_QTY, i.maxStock || MAX_QTY)) } : i))),
      remove: (key) => setItems((list) => list.filter((i) => i.key !== key)),
      toggleSelected: (key, selected) => setItems((list) => list.map((i) => (i.key === key ? { ...i, selected } : i))),
      setAllSelected: (selected) => setItems((list) => list.map((i) => ({ ...i, selected }))),
      replace: (next) => setItems(next),
      clearSelected: () => setItems((list) => list.filter((i) => !i.selected)),
      clear: () => setItems([]),
    }),
    [items, ready, add],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
