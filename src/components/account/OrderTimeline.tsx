import { Icon } from "@/components/ui/Icon";
import { ORDER_STEPS, STATUS_LABEL, stepIndex } from "@/lib/orders";
import { cn, formatDateTime } from "@/lib/format";
import type { OrderStatus, OrderStatusEvent } from "@/lib/types";

/** Vertical tracking timeline: Order Placed → … → Delivered. */
export function OrderTimeline({ status, history }: { status: OrderStatus; history: OrderStatusEvent[] }) {
  if (status === "cancelled") {
    const ev = history.find((h) => h.status === "cancelled");
    return (
      <div className="flex items-start gap-3 p-space-md rounded-xl bg-error-container/60">
        <Icon name="cancel" className="text-[22px] text-error" />
        <div>
          <p className="font-label-lg text-label-lg text-on-error-container">{STATUS_LABEL.cancelled}</p>
          {ev ? <p className="font-body-sm text-body-sm text-on-error-container">{ev.note ?? ""} · {formatDateTime(ev.created_at)}</p> : null}
        </div>
      </div>
    );
  }
  const current = stepIndex(status);
  const firstAt = (s: OrderStatus) => history.find((h) => h.status === s)?.created_at;
  return (
    <ol className="flex flex-col">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        const at = firstAt(step.status);
        return (
          <li key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  done ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline",
                  active && "ring-4 ring-primary/15",
                )}
              >
                <Icon name={done && !active ? "check" : step.icon} className="text-[18px]" />
              </div>
              {i < ORDER_STEPS.length - 1 ? <div className={cn("w-0.5 flex-1 min-h-[20px]", i < current ? "bg-primary" : "bg-surface-container-high")} /> : null}
            </div>
            <div className="pb-4 pt-1 min-w-0">
              <p className={cn("font-label-lg text-label-lg", done ? "text-on-surface" : "text-outline")}>{step.label}</p>
              {at ? <p className="font-body-sm text-body-sm text-secondary">{formatDateTime(at)}</p> : active ? null : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
