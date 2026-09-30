"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function PaymentButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const set = async (status: "paid" | "failed") => {
    if (status === "failed" && !confirm("Reject this payment?")) return;
    setBusy(true);
    const { error } = await getSupabaseBrowser().rpc("admin_set_payment_status", { p_order: orderId, p_status: status, p_note: null });
    setBusy(false);
    if (error) toast(error.message, "error");
    else {
      toast(status === "paid" ? "Payment verified" : "Payment rejected");
      router.refresh();
    }
  };
  return (
    <div className="flex gap-1">
      <button type="button" disabled={busy} onClick={() => void set("paid")} className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50">
        Verify
      </button>
      <button type="button" disabled={busy} onClick={() => void set("failed")} className="px-2.5 py-1 rounded-lg bg-surface-container text-error font-label-md text-label-md disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
