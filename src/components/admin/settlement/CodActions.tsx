"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { CodSettlementStatus } from "@/lib/settlement";

/** Admin records what the courier actually remitted and verifies it. */
export function VerifyCodButton({
  shipmentId,
  codAmount,
  deductions,
  current,
}: {
  shipmentId: string;
  codAmount: number;
  deductions: number;
  current: { received: number | null; date: string | null; reference: string | null; status: CodSettlementStatus };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const expected = Math.max(0, codAmount - deductions);
  const [f, setF] = useState({
    received: String(current.received ?? expected),
    date: current.date ?? new Date().toISOString().slice(0, 10),
    reference: current.reference ?? "",
    status: (current.status === "pending" ? "verified" : current.status) as CodSettlementStatus,
  });
  const [busy, setBusy] = useState(false);
  const variance = (Number(f.received) || 0) - expected;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md whitespace-nowrap">
        {current.status === "verified" ? "Edit" : "Verify COD"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Verify COD received">
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-surface-container-low font-body-md text-body-md tabular flex flex-col gap-1">
            <div className="flex justify-between"><span className="text-secondary">COD collected by courier</span><span>{formatPKR(codAmount)}</span></div>
            <div className="flex justify-between"><span className="text-secondary">Courier deductions</span><span>- {formatPKR(deductions)}</span></div>
            <div className="flex justify-between font-label-lg text-label-lg"><span>Expected remittance</span><span>{formatPKR(expected)}</span></div>
          </div>
          <Input label="Amount received in NEXORA account (Rs.)" name="received" inputMode="decimal" value={f.received} onChange={(e) => setF({ ...f, received: e.target.value.replace(/[^\d.]/g, "") })} />
          {variance !== 0 ? (
            <p className={`font-body-sm text-body-sm ${variance < 0 ? "text-error" : "text-primary"}`}>
              Difference vs expected: {variance < 0 ? "-" : "+"}
              {formatPKR(Math.abs(variance))}
            </p>
          ) : null}
          <Input label="Courier settlement date" name="date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Input label="Payment / reference number" name="reference" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Courier remittance / bank ref" />
          <Select label="Status" name="cod_status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CodSettlementStatus })}>
            <option value="verified">Verified — release to seller balance</option>
            <option value="received">Received — not verified yet</option>
            <option value="disputed">Disputed — amount doesn&apos;t match</option>
          </Select>
          <Button
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await getSupabaseBrowser().rpc("admin_verify_cod", {
                p_shipment: shipmentId,
                p_received_amount: Number(f.received) || 0,
                p_settlement_date: f.date || null,
                p_reference: f.reference,
                p_status: f.status,
              });
              setBusy(false);
              if (error) toast(error.message, "error");
              else {
                toast(f.status === "verified" ? "COD verified — seller balance available" : "COD status saved");
                setOpen(false);
                router.refresh();
              }
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </>
  );
}
