import type { Metadata } from "next";
import { NotificationList } from "@/components/account/NotificationList";
import { StackHeader } from "@/components/layout/StackHeader";
import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/account/notifications");
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <StackHeader title="Notifications" fallbackHref="/account" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md">
        <NotificationList items={(data ?? []) as Notification[]} />
      </main>
    </>
  );
}
