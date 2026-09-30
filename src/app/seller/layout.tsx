import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Seller", template: "%s · NEXORA Seller" }, robots: { index: false } };

/** Seller area — read-only finances. RLS limits sellers to their own store. */
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("vendor", "/seller");
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-40 pt-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 px-margin flex items-center justify-between max-w-screen-lg mx-auto">
          <Link href="/seller" className="flex items-center gap-2">
            <img src="/brand/nexora-mark.svg" alt="" className="w-7 h-7 rounded-md" />
            <span className="font-headline-sm text-headline-sm">Seller</span>
          </Link>
          <Link href="/account" className="flex items-center gap-1 font-label-md text-label-md text-secondary">
            <Icon name="person" className="text-[20px]" /> {profile.full_name?.split(" ")[0] ?? "Account"}
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-screen-lg mx-auto px-margin py-space-md pb-12">{children}</main>
    </div>
  );
}
