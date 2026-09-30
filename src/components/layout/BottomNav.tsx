"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/components/providers/CartProvider";
import { cn } from "@/lib/format";

const TABS = [
  { href: "/", label: "Home", icon: "home", match: (p: string) => p === "/" },
  { href: "/categories", label: "Categories", icon: "grid_view", match: (p: string) => p.startsWith("/categories") },
  { href: "/search", label: "Search", icon: "search", match: (p: string) => p.startsWith("/search") },
  { href: "/cart", label: "Cart", icon: "shopping_bag", match: (p: string) => p.startsWith("/cart") },
  { href: "/account", label: "Account", icon: "person", match: (p: string) => p.startsWith("/account") || p.startsWith("/wishlist") },
];

/** Fixed bottom tab bar — identical to the Stitch Concept 2 nav. */
export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 w-full z-50 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] lg:hidden"
    >
      <div className="flex justify-around items-center h-16 px-space-xs max-w-screen-md mx-auto">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-12 transition-colors relative",
                active ? "text-on-surface font-bold" : "text-secondary hover:text-on-surface",
              )}
            >
              {t.href === "/cart" ? (
                <div className="relative flex items-center justify-center">
                  <Icon name={t.icon} className="text-[22px]" filled={active} />
                  {count > 0 ? (
                    <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] bg-primary text-on-primary font-label-sm text-[9px] leading-[14px] rounded-full text-center font-bold">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </div>
              ) : (
                <Icon name={t.icon} className="text-[22px]" filled={active} />
              )}
              <span className="font-label-sm text-label-sm mt-0.5">{t.label}</span>
              {active ? <span className="w-1 h-1 rounded-full bg-primary mt-0.5" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
