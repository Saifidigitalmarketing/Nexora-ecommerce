import { PAYMENT_STATUS_LABEL, STATUS_LABEL, paymentTone, statusTone } from "@/lib/orders";
import { cn } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap", statusTone(status), className)}>{STATUS_LABEL[status]}</span>;
}

export function PaymentChip({ status, className }: { status: PaymentStatus; className?: string }) {
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap", paymentTone(status), className)}>{PAYMENT_STATUS_LABEL[status]}</span>;
}
