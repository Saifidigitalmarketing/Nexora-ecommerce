// Courier, COD and seller settlement — types, labels and courier registry.
// All money figures are calculated in the database (_recompute_settlement);
// the UI only displays them.

export type ShipmentStatus = "booked" | "in_transit" | "delivered" | "returned" | "cancelled";
export type CodSettlementStatus = "pending" | "received" | "verified" | "disputed" | "not_applicable";
export type SellerSettlementStatus = "pending" | "available" | "approved" | "paid" | "on_hold" | "cancelled";

export interface Courier {
  id: string;
  name: string;
  code: string;
  default_charge: number;
  tracking_url_template: string | null;
  is_active: boolean;
}

export interface Shipment {
  id: string;
  order_id: string;
  order_number: string | null;
  vendor_id: string;
  courier_id: string | null;
  tracking_number: string | null;
  status: ShipmentStatus;
  cod_amount: number;
  courier_charges: number;
  other_deductions: number;
  booked_at: string;
  delivered_at: string | null;
  cod_settlement_status: CodSettlementStatus;
  cod_received_amount: number | null;
  cod_settlement_date: string | null;
  cod_settlement_reference: string | null;
  notes: string | null;
}

export interface SellerSettlement {
  id: string;
  shipment_id: string;
  order_id: string;
  vendor_id: string;
  gross_sales: number;
  courier_deductions: number;
  commission_type: "percent" | "fixed";
  commission_rate: number;
  commission_amount: number;
  seller_payable: number;
  status: SellerSettlementStatus;
  approved_at: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface SellerSummary {
  total_sales: number;
  pending_balance: number;
  available_balance: number;
  commission: number;
  courier_deductions: number;
  total_paid: number;
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  booked: "Booked",
  in_transit: "In Transit",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const COD_STATUS_LABEL: Record<CodSettlementStatus, string> = {
  pending: "COD pending",
  received: "Received — not verified",
  verified: "COD received by NEXORA",
  disputed: "Disputed",
  not_applicable: "Prepaid — no COD",
};

/**
 * COD stage for a shipment. "Delivered" never means NEXORA has the money:
 * after delivery the cash is with the courier/rider until an admin verifies it.
 */
export function codStageLabel(shipment: { status: ShipmentStatus; cod_settlement_status: CodSettlementStatus }): string {
  if (shipment.cod_settlement_status === "pending" && shipment.status === "delivered") return "Collected — courier settlement pending";
  return COD_STATUS_LABEL[shipment.cod_settlement_status];
}

export const SETTLEMENT_STATUS_LABEL: Record<SellerSettlementStatus, string> = {
  pending: "Not yet payable",
  available: "Seller payable",
  approved: "Payout pending",
  paid: "Seller paid",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

export function settlementTone(s: SellerSettlementStatus | CodSettlementStatus): string {
  if (s === "paid" || s === "verified") return "bg-primary-fixed/40 text-on-primary-fixed-variant";
  if (s === "available" || s === "approved" || s === "received") return "bg-primary/10 text-primary";
  if (s === "on_hold" || s === "disputed" || s === "cancelled") return "bg-error-container text-on-error-container";
  return "bg-surface-container-high text-secondary";
}

/** Tracking link from the courier's admin-configured template ("{tracking}" placeholder). */
export function trackingUrl(courier: Pick<Courier, "tracking_url_template"> | null | undefined, tracking: string | null): string | null {
  if (!courier?.tracking_url_template || !tracking) return null;
  return courier.tracking_url_template.replace("{tracking}", encodeURIComponent(tracking));
}

/**
 * Future courier API integrations (TCS, Leopards, M&P, Trax…) plug in here,
 * keyed by couriers.code. Implement server-side only with credentials from
 * environment variables; results are saved via admin_save_shipment().
 * No courier API is integrated yet.
 */
export interface CourierIntegration {
  code: string;
  bookShipment(input: { orderNumber: string; codAmount: number; consignee: { name: string; phone: string; address: string; city: string } }): Promise<{ trackingNumber: string; charges?: number }>;
  getStatus(trackingNumber: string): Promise<{ status: ShipmentStatus; deliveredAt?: string }>;
}

export const COURIER_INTEGRATIONS: Record<string, CourierIntegration | undefined> = {};
