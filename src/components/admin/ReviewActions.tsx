"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function ReviewActions({ id, approved }: { id: string; approved: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = getSupabaseBrowser();
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={async () => {
          const { error } = await supabase.from("reviews").update({ is_approved: !approved }).eq("id", id);
          if (error) toast(error.message, "error");
          else router.refresh();
        }}
        className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-label-md"
      >
        {approved ? "Hide" : "Approve"}
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Delete this review?")) return;
          const { error } = await supabase.from("reviews").delete().eq("id", id);
          if (error) toast(error.message, "error");
          else router.refresh();
        }}
        className="px-2.5 py-1 rounded-lg bg-surface-container text-error font-label-md text-label-md"
      >
        Delete
      </button>
    </div>
  );
}
