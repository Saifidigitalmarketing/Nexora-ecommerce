import type { PaymentMethod } from "@/lib/types";

/**
 * Payment method registry.
 *
 * kind:
 *  - "cash"     : collected by the rider on delivery (COD)
 *  - "manual"   : customer transfers to NEXORA's wallet/bank account and
 *                 submits the Transaction ID; admin verifies in Admin → Payments
 *  - "gateway"  : online payment through a provider API (not enabled yet)
 *
 * To add an online gateway later (e.g. card, JazzCash/Easypaisa checkout APIs):
 *  1. implement `PaymentGateway` in src/lib/payments/gateways/<provider>.ts
 *     (server-only, secrets from env — never NEXT_PUBLIC_)
 *  2. create the order with place_order(), then call gateway.createSession()
 *     from a server route and redirect the shopper
 *  3. confirm payment in /api/payments/webhook/<provider> by verifying the
 *     provider signature and updating public.payments / orders.payment_status
 *     with the service role on the server
 *  4. flip `enabled` below and allow the method in place_order()
 */
export interface PaymentOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
  kind: "cash" | "manual" | "gateway";
  enabled: boolean;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: "cod", label: "Cash on Delivery", description: "Pay in cash when your order arrives", icon: "payments", kind: "cash", enabled: true },
  { id: "easypaisa", label: "Easypaisa", description: "Send to our Easypaisa account, then enter the TID", icon: "account_balance_wallet", kind: "manual", enabled: true },
  { id: "jazzcash", label: "JazzCash", description: "Send to our JazzCash account, then enter the TID", icon: "account_balance_wallet", kind: "manual", enabled: true },
  { id: "bank_transfer", label: "Bank Transfer", description: "IBFT / bank deposit to our account", icon: "account_balance", kind: "manual", enabled: true },
  { id: "card", label: "Debit / Credit Card", description: "Coming soon", icon: "credit_card", kind: "gateway", enabled: false },
];

export interface PaymentAccounts {
  easypaisa?: { title?: string; number?: string };
  jazzcash?: { title?: string; number?: string };
  bank_transfer?: { bank?: string; title?: string; account_number?: string; iban?: string };
}

/** Contract for future online gateways (server-side only). */
export interface PaymentGateway {
  id: PaymentMethod;
  createSession(input: { orderId: string; orderNumber: string; amount: number; customerEmail?: string | null; returnUrl: string }): Promise<{ redirectUrl: string; reference: string }>;
  verifyWebhook(request: Request): Promise<{ orderNumber: string; reference: string; status: "paid" | "failed" } | null>;
}
