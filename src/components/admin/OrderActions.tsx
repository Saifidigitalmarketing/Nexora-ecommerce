"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/types";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { placed: "confirmed", confirmed: "processing" };

export function OrderActions({ order, riders }: { order: Order; riders: { id: string; name: string; zone: string | null }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [rider, setRider] = useState(order.rider_id ?? "");
  const [note, setNote] = useState("");
  const supabase = getSupabaseBrowser();

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) toast(error.message, "error");
    else {
      toast(ok);
      setNote("");
      router.refresh();
    }
  };

  const closed = order.status === "delivered" || order.status === "cancelled";
  const next = NEXT[order.status];
  const canAssign = ["placed", "confirmed", "processing", "assigned"].includes(order.status);

  return (
    <div className="flex flex-col gap-4">
      {!closed ? (
        <>
          <Textarea label="Note to customer" optional name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Shown in the customer's order timeline notification" />
          {next ? (
            <Button loading={busy === "next"} onClick={() => run("next", () => supabase.rpc("admin_update_order_status", { p_order: order.id, p_status: next, p_note: note || null }), `Marked ${STATUS_LABEL[next]}`)}>
              Mark as {STATUS_LABEL[next]}
            </Button>
          ) : null}
          {canAssign ? (
            <div className="flex flex-col gap-2">
              <Select label="Assign rider" name="rider" value={rider} onChange={(e) => setRider(e.target.value)}>
                <option value="">Select a rider…</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.zone ? ` · ${r.zone}` : ""}
                  </option>
                ))}
              </Select>
              <Button
                variant="ink"
                disabled={!rider || rider === order.rider_id}
                loading={busy === "rider"}
                onClick={() => run("rider", () => supabase.rpc("admin_assign_rider", { p_order: order.id, p_rider: rider }), "Rider assigned")}
              >
                {order.rider_id ? "Reassign rider" : "Assign rider"}
              </Button>
              {!riders.length ? <p className="font-body-sm text-body-sm text-secondary">No active riders. Add one under Riders.</p> : null}
            </div>
          ) : null}
          {order.status === "on_the_way" ? (
            <Button variant="soft" loading={busy === "delivered"} onClick={() => run("delivered", () => supabase.rpc("admin_update_order_status", { p_order: order.id, p_status: "delivered", p_note: note || null }), "Marked delivered")}>
              Mark delivered
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="text-error"
            loading={busy === "cancel"}
            onClick={() => {
              if (confirm("Cancel this order? Stock will be returned.")) void run("cancel", () => supabase.rpc("admin_update_order_status", { p_order: order.id, p_status: "cancelled", p_note: note || null }), "Order cancelled");
            }}
          >
            Cancel order
          </Button>
        </>
      ) : (
        <p className="font-body-md text-body-md text-secondary">This order is {STATUS_LABEL[order.status].toLowerCase()} — no further actions.</p>
      )}

      {order.payment_method !== "cod" && order.payment_status !== "paid" && order.status !== "cancelled" ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-surface-container-high">
          <p className="font-label-lg text-label-lg">Payment verification</p>
          <p className="font-body-sm text-body-sm text-secondary">Transaction ID: {order.payment_reference ?? "not provided"}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button loading={busy === "paid"} onClick={() => run("paid", () => supabase.rpc("admin_set_payment_status", { p_order: order.id, p_status: "paid", p_note: note || null }), "Payment verified")}>
              Mark paid
            </Button>
            <Button variant="outline" className="text-error" loading={busy === "failed"} onClick={() => run("failed", () => supabase.rpc("admin_set_payment_status", { p_order: order.id, p_status: "failed", p_note: note || null }), "Payment marked failed")}>
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
