import type { OrderStatus, PaymentMethod, PaymentStatus } from "./types";

/** Customer-facing tracking steps, in order. */
export const ORDER_STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: "placed", label: "Order Placed", icon: "receipt_long" },
  { status: "confirmed", label: "Order Confirmed", icon: "task_alt" },
  { status: "processing", label: "Processing", icon: "inventory_2" },
  { status: "assigned", label: "Assigned to Rider", icon: "badge" },
  { status: "picked_up", label: "Picked Up", icon: "package_2" },
  { status: "on_the_way", label: "On The Way", icon: "two_wheeler" },
  { status: "delivered", label: "Delivered", icon: "home_pin" },
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  assigned: "Assigned to Rider",
  picked_up: "Picked Up",
  on_the_way: "On The Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function stepIndex(status: OrderStatus): number {
  return ORDER_STEPS.findIndex((s) => s.status === status);
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank_transfer: "Bank Transfer",
  card: "Debit / Credit Card",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  awaiting_verification: "Awaiting verification",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

/** Status chip styling — neutral/emerald, error only for failures. */
export function statusTone(status: OrderStatus): string {
  if (status === "delivered") return "bg-primary-fixed/40 text-on-primary-fixed-variant";
  if (status === "cancelled") return "bg-error-container text-on-error-container";
  if (status === "placed") return "bg-surface-container-high text-on-surface";
  return "bg-primary/10 text-primary";
}

export function paymentTone(status: PaymentStatus): string {
  if (status === "paid") return "bg-primary-fixed/40 text-on-primary-fixed-variant";
  if (status === "failed" || status === "refunded") return "bg-error-container text-on-error-container";
  if (status === "awaiting_verification") return "bg-secondary-container text-on-secondary-container";
  return "bg-surface-container-high text-secondary";
}
