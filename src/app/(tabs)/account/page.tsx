import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/account/SignOutButton";
import { StatusChip } from "@/components/account/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth";
import { formatPKR, initials } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "My Account" };

const MENU = [
  { href: "/account/orders", icon: "receipt_long", label: "My Orders" },
  { href: "/wishlist", icon: "favorite", label: "Wishlist" },
  { href: "/account/addresses", icon: "home_pin", label: "Saved Addresses" },
  { href: "/account/coupons", icon: "confirmation_number", label: "Coupons" },
  { href: "/account/notifications", icon: "notifications", label: "Notifications" },
  { href: "/account/reviews", icon: "rate_review", label: "My Reviews" },
  { href: "/account/profile", icon: "person", label: "Profile & Security" },
  { href: "/help", icon: "support_agent", label: "Help & Support" },
];

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { userId, profile } = await requireUser("/account");
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const [{ data: orders, count: orderCount }, { count: wishCount }, { count: unread }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, total, created_at", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    supabase.from("wishlist_items").select("product_id", { count: "exact", head: true }),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  const latest = (orders?.[0] as Pick<Order, "order_number" | "status" | "total" | "created_at">) ?? null;

  return (
    <div className="flex flex-col w-full px-margin pt-space-md pb-8 gap-space-md max-w-2xl mx-auto">
      {sp.denied ? (
        <div className="p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md flex items-center gap-2">
          <Icon name="lock" className="text-[18px]" /> You don&apos;t have access to that area.
        </div>
      ) : null}

      <div className="flex items-center gap-3 bg-surface-container-lowest rounded-xl shadow-sm p-space-md">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold">
          {initials(profile.full_name || profile.email)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-headline-sm text-headline-sm text-on-surface truncate">{profile.full_name || "NEXORA Shopper"}</p>
          <p className="font-body-sm text-body-sm text-secondary truncate">{profile.email}</p>
          {profile.phone ? <p className="font-body-sm text-body-sm text-secondary">{profile.phone}</p> : null}
        </div>
        <Link href="/account/profile" aria-label="Edit profile" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
          <Icon name="edit" className="text-[18px]" />
        </Link>
      </div>

      {profile.role === "admin" || profile.role === "rider" ? (
        <Link
          href={profile.role === "admin" ? "/admin" : "/rider"}
          className="flex items-center justify-between bg-on-surface text-surface rounded-xl p-space-md shadow-sm"
        >
          <span className="flex items-center gap-2 font-label-lg text-label-lg">
            <Icon name={profile.role === "admin" ? "admin_panel_settings" : "two_wheeler"} className="text-[22px]" />
            {profile.role === "admin" ? "Open Admin Dashboard" : "Open Rider Dashboard"}
          </span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </Link>
      ) : null}

      <div className="grid grid-cols-3 gap-space-sm">
        {[
          { href: "/account/orders", v: orderCount ?? 0, l: "Orders" },
          { href: "/wishlist", v: wishCount ?? 0, l: "Wishlist" },
          { href: "/account/notifications", v: unread ?? 0, l: "Unread" },
        ].map((s) => (
          <Link key={s.l} href={s.href} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col items-center">
            <span className="font-price-md text-price-md text-on-surface tabular">{s.v}</span>
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">{s.l}</span>
          </Link>
        ))}
      </div>

      {latest ? (
        <Link href={`/account/orders/${latest.order_number}`} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Latest order</p>
            <p className="font-label-lg text-label-lg text-on-surface">{latest.order_number}</p>
            <p className="font-body-sm text-body-sm text-secondary tabular">{formatPKR(latest.total)}</p>
          </div>
          <div className="flex items-center gap-1">
            <StatusChip status={latest.status} />
            <Icon name="chevron_right" className="text-[20px] text-secondary" />
          </div>
        </Link>
      ) : null}

      <nav className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden divide-y divide-surface-container-low">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href} className="flex items-center gap-3 px-space-md py-3.5 hover:bg-surface-container-low transition-colors">
            <Icon name={m.icon} className="text-[20px] text-primary" />
            <span className="flex-1 font-label-lg text-label-lg text-on-surface">{m.label}</span>
            <Icon name="chevron_right" className="text-[20px] text-secondary" />
          </Link>
        ))}
        <SignOutButton />
      </nav>
      <p className="text-center font-label-sm text-label-sm text-secondary tracking-widest uppercase">NEXORA • Everything. One Place.</p>
    </div>
  );
}
