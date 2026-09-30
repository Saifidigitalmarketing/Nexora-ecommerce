"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

export const ADMIN_LINKS = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/orders", icon: "receipt_long", label: "Orders" },
  { href: "/admin/products", icon: "inventory_2", label: "Products" },
  { href: "/admin/categories", icon: "category", label: "Categories" },
  { href: "/admin/brands", icon: "storefront", label: "Brands & Stores" },
  { href: "/admin/inventory", icon: "warehouse", label: "Inventory" },
  { href: "/admin/customers", icon: "group", label: "Customers" },
  { href: "/admin/payments", icon: "account_balance_wallet", label: "Payments" },
  { href: "/admin/settlements", icon: "handshake", label: "Shipments & Settlements" },
  { href: "/admin/coupons", icon: "confirmation_number", label: "Coupons" },
  { href: "/admin/delivery", icon: "local_shipping", label: "Delivery Charges" },
  { href: "/admin/riders", icon: "two_wheeler", label: "Riders" },
  { href: "/admin/reviews", icon: "rate_review", label: "Reviews" },
  { href: "/admin/support", icon: "support_agent", label: "Support" },
  { href: "/admin/reports", icon: "monitoring", label: "Reports" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Admin">
      {ADMIN_LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg transition-colors",
              active ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-low",
            )}
          >
            <Icon name={l.icon} className="text-[20px]" filled={active} />
            {l.label}
          </Link>
        );
      })}
      <div className="h-px bg-surface-container-high my-2" />
      <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg text-secondary hover:bg-surface-container-low">
        <Icon name="storefront" className="text-[20px]" /> View store
      </Link>
    </nav>
  );
}

export function AdminSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-surface-container-lowest border-r border-surface-container-high h-screen sticky top-0 overflow-y-auto">
      <div className="h-16 flex items-center gap-2 px-4 border-b border-surface-container-high">
        <img src="/brand/nexora-logo.svg" alt="NEXORA" className="h-7" />
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Admin</span>
      </div>
      <NavList />
    </aside>
  );
}

export function AdminMobileBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const current = [...ADMIN_LINKS].reverse().find((l) => (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href)));
  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 h-14 pt-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between px-margin">
        <button type="button" aria-label="Open admin menu" onClick={() => setOpen(true)} className="w-10 h-10 -ml-2 flex items-center justify-center">
          <Icon name="menu" className="text-[24px]" />
        </button>
        <span className="font-headline-sm text-headline-sm">{current?.label ?? "Admin"}</span>
        <img src="/brand/nexora-mark.svg" alt="" className="w-7 h-7 rounded-md" />
      </header>
      {open ? (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="w-72 max-w-[85vw] bg-surface-container-lowest h-full overflow-y-auto shadow-xl pt-safe">
            <div className="h-14 flex items-center justify-between px-4 border-b border-surface-container-high">
              <img src="/brand/nexora-logo.svg" alt="NEXORA" className="h-7" />
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center">
                <Icon name="close" className="text-[22px]" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
          <button type="button" aria-label="Close menu" className="flex-1 bg-on-surface/40" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
