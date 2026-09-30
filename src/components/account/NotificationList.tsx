"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

export function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const markAll = async () => {
    await getSupabaseBrowser().from("notifications").update({ is_read: true }).eq("is_read", false);
    router.refresh();
  };
  const markOne = (id: string) => getSupabaseBrowser().from("notifications").update({ is_read: true }).eq("id", id);

  if (!items.length) return <EmptyState icon="notifications" title="You're all caught up" description="Order updates and offers will appear here." />;
  return (
    <div className="flex flex-col gap-space-sm">
      {items.some((n) => !n.is_read) ? (
        <button type="button" onClick={() => void markAll()} className="self-end font-label-md text-label-md text-primary">
          Mark all as read
        </button>
      ) : null}
      {items.map((n) => (
        <Link
          key={n.id}
          href={n.link ?? "#"}
          onClick={() => void markOne(n.id)}
          className={cn("bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex gap-3", !n.is_read && "ring-1 ring-primary/20")}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="notifications" className="text-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-lg text-label-lg text-on-surface flex items-center gap-2">
              {n.title}
              {!n.is_read ? <span className="w-2 h-2 rounded-full bg-primary" /> : null}
            </p>
            {n.body ? <p className="font-body-sm text-body-sm text-secondary">{n.body}</p> : null}
            <p className="font-body-sm text-body-sm text-outline mt-0.5">{formatDateTime(n.created_at)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
