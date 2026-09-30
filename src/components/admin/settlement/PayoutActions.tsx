"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { SellerSettlementStatus } from "@/lib/settlement";

/** Approve → Mark paid (with reference) → optional hold/release. */
export function PayoutActions({ id, status, payable, seller }: { id: string; status: SellerSettlementStatus; payable: number; seller: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const supabase = getSupabaseBrowser();

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) toast(error.message, "error");
    else {
      toast(ok);
      setPayOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="flex gap-1 justify-end">
      {status === "available" ? (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("approve", () => supabase.rpc("admin_approve_settlement", { p_settlement: id, p_note: null }), "Settlement approved")}
          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md whitespace-nowrap"
        >
          Approve
        </button>
      ) : null}
      {status === "approved" ? (
        <button type="button" onClick={() => setPayOpen(true)} className="px-2.5 py-1 rounded-lg bg-on-surface text-surface font-label-md text-label-md whitespace-nowrap">
          Mark paid
        </button>
      ) : null}
      {["pending", "available", "approved"].includes(status) ? (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("hold", () => supabase.rpc("admin_hold_settlement", { p_settlement: id, p_hold: true, p_note: null }), "Settlement on hold")}
          className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-label-md"
        >
          Hold
        </button>
      ) : null}
      {status === "on_hold" ? (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("release", () => supabase.rpc("admin_hold_settlement", { p_settlement: id, p_hold: false, p_note: null }), "Settlement released")}
          className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-label-md"
        >
          Release
        </button>
      ) : null}
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="Mark seller payment as paid">
        <div className="flex flex-col gap-3">
          <p className="font-body-md text-body-md">
            Pay <strong className="tabular">{formatPKR(payable)}</strong> to <strong>{seller}</strong>, then record the transfer below.
          </p>
          <Input label="Payment / reference number" name="payout_ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="IBFT / cheque / wallet TID" />
          <Input label="Payment date" name="paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          <Button
            size="lg"
            disabled={!ref.trim()}
            loading={busy === "pay"}
            onClick={() =>
              run(
                "pay",
                () => supabase.rpc("admin_mark_settlement_paid", { p_settlement: id, p_reference: ref.trim(), p_paid_at: paidAt ? new Date(paidAt).toISOString() : null, p_note: null }),
                "Marked as paid",
              )
            }
          >
            Confirm payment
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
