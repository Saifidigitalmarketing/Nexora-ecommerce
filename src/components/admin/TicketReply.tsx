"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function TicketReply({ id, reply, status }: { id: string; reply: string | null; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(reply ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (nextStatus: string) => {
    setBusy(true);
    const { error } = await getSupabaseBrowser().from("support_tickets").update({ admin_reply: text.trim() || null, status: nextStatus }).eq("id", id);
    setBusy(false);
    if (error) toast(error.message, "error");
    else {
      toast("Ticket updated");
      router.refresh();
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full bg-surface-container-low rounded-lg px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder="Write a reply the customer will see"
      />
      <div className="flex gap-2">
        <Button size="sm" loading={busy} disabled={!text.trim()} onClick={() => void save("answered")}>
          Send reply
        </Button>
        {status !== "closed" ? (
          <Button size="sm" variant="outline" onClick={() => void save("closed")}>
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}
