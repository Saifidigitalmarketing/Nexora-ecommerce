import type { Metadata } from "next";
import { TicketReply } from "@/components/admin/TicketReply";
import { AdminPage, Card } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support" };

export default async function AdminSupport() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("support_tickets").select("*, profile:profiles(full_name, email, phone)").order("created_at", { ascending: false }).limit(100);
  type T = { id: string; subject: string; message: string; status: string; admin_reply: string | null; created_at: string; profile: { full_name: string | null; email: string | null; phone: string | null } | null };
  const rows = (data ?? []) as T[];
  return (
    <AdminPage title="Support" subtitle="Messages from Help & Support.">
      {rows.map((t) => (
        <Card key={t.id} title={t.subject} actions={<span className="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm capitalize">{t.status}</span>}>
          <p className="font-body-sm text-body-sm text-secondary mb-2">
            {t.profile?.full_name} · {t.profile?.email} {t.profile?.phone ? `· ${t.profile.phone}` : ""} · {formatDateTime(t.created_at)}
          </p>
          <p className="font-body-md text-body-md whitespace-pre-line mb-3">{t.message}</p>
          <TicketReply id={t.id} reply={t.admin_reply} status={t.status} />
        </Card>
      ))}
      {!rows.length ? <p className="font-body-md text-body-md text-secondary">No support messages.</p> : null}
    </AdminPage>
  );
}
