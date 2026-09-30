"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function DeleteReviewButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Delete review"
      onClick={async () => {
        if (!confirm("Delete this review?")) return;
        await getSupabaseBrowser().from("reviews").delete().eq("id", id);
        router.refresh();
      }}
      className="w-8 h-8 rounded-full hover:bg-error-container flex items-center justify-center text-secondary hover:text-error"
    >
      <Icon name="delete" className="text-[18px]" />
    </button>
  );
}
