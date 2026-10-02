"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Order } from "@/lib/types";

/** One primary action per step: Accept → Picked Up → On The Way → Delivered. */
export function RiderActions({ order }: { order: Pick<Order, "id" | "status" | "rider_accepted_at" | "payment_method" | "payment_status" | "total"> }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  let action: { key: string; label: string; icon: string } | null = null;
  if (order.status === "assigned" && !order.rider_accepted_at) action = { key: "accept", label: "Accept order", icon: "check_circle" };
  else if (order.status === "assigned") action = { key: "picked_up", label: "Mark Picked Up", icon: "package_2" };
  else if (order.status === "picked_up") action = { key: "on_the_way", label: "Start — On The Way", icon: "two_wheeler" };
  else if (order.status === "on_the_way") action = { key: "delivered", label: "Mark Delivered", icon: "home_pin" };
  if (!action) return null;

  const run = async () => {
    if (action!.key === "delivered") {
      const cod = order.payment_method === "cod" && order.payment_status === "pending";
      if (!confirm(cod ? `Confirm you collected ${formatPKR(order.total)} in cash and delivered the order?` : "Confirm the order was delivered?")) return;
    }
    setBusy(true);
    const { error } = await getSupabaseBrowser().rpc("rider_update_order", { p_order: order.id, p_action: action!.key });
    setBusy(false);
    if (error) toast(error.message, "error");
    else {
      toast(action!.key === "accept" ? "Order accepted" : "Status updated");
      router.refresh();
    }
  };

  return (
    <Button size="lg" variant={action.key === "delivered" ? "primary" : "ink"} loading={busy} onClick={() => void run()} className="w-full">
      <Icon name={action.icon} className="text-[20px]" /> {action.label}
    </Button>
  );
}
