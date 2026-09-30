"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full text-error" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Cancel this order?">
        <div className="flex flex-col gap-3">
          <Textarea label="Reason" optional name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <Button
            variant="danger"
            size="lg"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              const { error } = await getSupabaseBrowser().rpc("cancel_my_order", { p_order: orderId, p_reason: reason });
              setLoading(false);
              if (error) {
                toast(error.message, "error");
                return;
              }
              toast("Order cancelled");
              setOpen(false);
              router.refresh();
            }}
          >
            Yes, cancel order
          </Button>
        </div>
      </Sheet>
    </>
  );
}
