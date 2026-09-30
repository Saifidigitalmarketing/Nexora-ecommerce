"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { initials } from "@/lib/format";

export function HeaderActions() {
  const { userId, profile } = useAuth();
  const { count } = useCart();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    getSupabaseBrowser()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .then(({ count: c }) => setUnread(c ?? 0));
  }, [userId]);

  return (
    <div className="flex items-center gap-space-xs">
      {/* Desktop keeps the same destinations as the mobile bottom nav */}
      <Link href="/search" aria-label="Search" className="hidden lg:flex w-11 h-11 items-center justify-center text-on-surface hover:text-primary">
        <Icon name="search" className="text-[22px]" />
      </Link>
      <Link href="/wishlist" aria-label="Wishlist" className="hidden lg:flex w-11 h-11 items-center justify-center text-on-surface hover:text-primary">
        <Icon name="favorite" className="text-[22px]" />
      </Link>
      <Link href="/cart" aria-label={`Cart, ${count} items`} className="hidden lg:flex w-11 h-11 relative items-center justify-center text-on-surface hover:text-primary">
        <Icon name="shopping_bag" className="text-[22px]" />
        {count > 0 ? (
          <span className="absolute top-1.5 right-1 px-1 min-w-[14px] h-[14px] bg-primary text-on-primary font-label-sm text-[9px] leading-[14px] rounded-full text-center font-bold">
            {count}
          </span>
        ) : null}
      </Link>
      <Link
        href={userId ? "/account/notifications" : "/login?next=/account/notifications"}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="w-11 h-11 relative flex items-center justify-center text-on-surface hover:text-primary transition-colors"
      >
        <Icon name="notifications" className="text-[22px]" />
        {unread > 0 ? <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-container-lowest" /> : null}
      </Link>
      <Link href={userId ? "/account" : "/login"} aria-label="Account" className="w-11 h-11 flex items-center justify-center">
        {profile?.avatar_url ? (
          <img alt="Profile" className="w-8 h-8 rounded-full object-cover" src={profile.avatar_url} />
        ) : userId ? (
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label-md text-label-md font-bold">
            {initials(profile?.full_name || profile?.email)}
          </span>
        ) : (
          <span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
            <Icon name="person" className="text-[20px]" />
          </span>
        )}
      </Link>
    </div>
  );
}
