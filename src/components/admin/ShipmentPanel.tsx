"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn, formatPKR } from "@/lib/format";
import {
  COD_STATUS_LABEL,
  SETTLEMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  settlementTone,
  trackingUrl,
  type Courier,
  type SellerSettlement,
  type Shipment,
  type ShipmentStatus,
} from "@/lib/settlement";

export interface OrderSellerPart {
  vendorId: string;
  vendorName: string;
  itemsTotal: number;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PartForm({
  orderId,
  part,
  suggestedCod,
  shipment,
  settlement,
  couriers,
}: {
  orderId: string;
  part: OrderSellerPart;
  suggestedCod: number;
  shipment?: Shipment;
  settlement?: SellerSettlement;
  couriers: Courier[];
}) {
  const router = useRouter();
  const toast = useToast();
  const locked = shipment?.cod_settlement_status === "verified";
  const [v, setV] = useState({
    courier_id: shipment?.courier_id ?? couriers[0]?.id ?? "",
    tracking: shipment?.tracking_number ?? "",
    status: (shipment?.status ?? "booked") as ShipmentStatus,
    cod: String(shipment?.cod_amount ?? suggestedCod),
    charges: String(shipment?.courier_charges ?? couriers[0]?.default_charge ?? 0),
    other: String(shipment?.other_deductions ?? 0),
    delivered_at: toLocalInput(shipment?.delivered_at ?? null),
  });
  const [busy, setBusy] = useState(false);
  const courier = couriers.find((c) => c.id === v.courier_id);
  const link = trackingUrl(courier, shipment?.tracking_number ?? null);

  const save = async () => {
    setBusy(true);
    const { error } = await getSupabaseBrowser().rpc("admin_save_shipment", {
      p_order: orderId,
      p_vendor: part.vendorId,
      p_courier: v.courier_id || null,
      p_tracking: v.tracking,
      p_status: v.status,
      p_cod_amount: Number(v.cod) || 0,
      p_courier_charges: Number(v.charges) || 0,
      p_other_deductions: Number(v.other) || 0,
      p_delivered_at: v.delivered_at ? new Date(v.delivered_at).toISOString() : null,
      p_notes: null,
    });
    setBusy(false);
    if (error) toast(error.message, "error");
    else {
      toast("Shipment saved");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface-container-low">
      <div className="flex items-center justify-between gap-2">
        <p className="font-label-lg text-label-lg flex items-center gap-1.5">
          <Icon name="storefront" className="text-[18px] text-primary" /> {part.vendorName}
        </p>
        <span className="font-body-sm text-body-sm text-secondary tabular">Items {formatPKR(part.itemsTotal)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Courier"
          name={`courier_${part.vendorId}`}
          value={v.courier_id}
          onChange={(e) => {
            const c = couriers.find((x) => x.id === e.target.value);
            setV({ ...v, courier_id: e.target.value, charges: shipment ? v.charges : String(c?.default_charge ?? 0) });
          }}
        >
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input label="Tracking number" name={`tracking_${part.vendorId}`} value={v.tracking} onChange={(e) => setV({ ...v, tracking: e.target.value })} />
        <Select label="Shipment status" name={`status_${part.vendorId}`} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ShipmentStatus })}>
          {(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Input label="Delivery date" optional name={`delivered_${part.vendorId}`} type="datetime-local" value={v.delivered_at} onChange={(e) => setV({ ...v, delivered_at: e.target.value })} />
        <Input label="COD amount (Rs.)" name={`cod_${part.vendorId}`} inputMode="decimal" disabled={locked} value={v.cod} onChange={(e) => setV({ ...v, cod: e.target.value.replace(/[^\d.]/g, "") })} />
        <Input label="Courier charges (Rs.)" name={`charges_${part.vendorId}`} inputMode="decimal" disabled={locked} value={v.charges} onChange={(e) => setV({ ...v, charges: e.target.value.replace(/[^\d.]/g, "") })} />
        <Input label="Other courier deductions" optional name={`other_${part.vendorId}`} inputMode="decimal" disabled={locked} value={v.other} onChange={(e) => setV({ ...v, other: e.target.value.replace(/[^\d.]/g, "") })} />
      </div>
      {locked ? <p className="font-body-sm text-body-sm text-secondary">COD is verified — amounts are locked.</p> : null}
      <Button size="sm" loading={busy} onClick={() => void save()}>
        {shipment ? "Update shipment" : "Book shipment"}
      </Button>

      {shipment ? (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container-high font-body-sm text-body-sm tabular">
          <div className="flex items-center justify-between">
            <span className="text-secondary">COD settlement</span>
            <span className={cn("px-2 py-0.5 rounded-full font-label-sm text-label-sm", settlementTone(shipment.cod_settlement_status))}>{COD_STATUS_LABEL[shipment.cod_settlement_status]}</span>
          </div>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              <Icon name="open_in_new" className="text-[14px]" /> Track on {courier?.name}
            </a>
          ) : null}
          {settlement ? (
            <>
              <div className="flex justify-between"><span className="text-secondary">Seller sales</span><span>{formatPKR(settlement.gross_sales)}</span></div>
              <div className="flex justify-between"><span className="text-secondary">Courier deductions</span><span>- {formatPKR(settlement.courier_deductions)}</span></div>
              <div className="flex justify-between">
                <span className="text-secondary">NEXORA commission ({settlement.commission_type === "percent" ? `${Number(settlement.commission_rate)}%` : "fixed"})</span>
                <span>- {formatPKR(settlement.commission_amount)}</span>
              </div>
              <div className="flex justify-between font-label-lg text-label-lg">
                <span>Seller payable</span>
                <span>{formatPKR(settlement.seller_payable)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">Seller settlement</span>
                <span className={cn("px-2 py-0.5 rounded-full font-label-sm text-label-sm", settlementTone(settlement.status))}>{SETTLEMENT_STATUS_LABEL[settlement.status]}</span>
              </div>
            </>
          ) : null}
          <Link href={`/admin/settlements?q=${encodeURIComponent(shipment.tracking_number ?? "")}`} className="text-primary font-label-md text-label-md">
            Verify COD / settle seller →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Courier shipments for an order — one per seller. */
export function ShipmentPanel({
  orderId,
  orderTotal,
  parts,
  shipments,
  settlements,
  couriers,
}: {
  orderId: string;
  orderTotal: number;
  parts: OrderSellerPart[];
  shipments: Shipment[];
  settlements: SellerSettlement[];
  couriers: Courier[];
}) {
  if (!couriers.length) {
    return (
      <p className="font-body-md text-body-md text-secondary">
        Add couriers in <Link href="/admin/settlements?tab=couriers" className="text-primary">Shipments &amp; Settlements</Link> first.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="font-body-sm text-body-sm text-secondary">Customers pay COD to the courier; the courier remits to NEXORA. Sellers are paid after COD is verified.</p>
      {parts.map((p) => {
        const sh = shipments.find((s) => s.vendor_id === p.vendorId);
        return (
          <PartForm
            key={p.vendorId}
            orderId={orderId}
            part={p}
            // single-seller orders: COD is the whole order total; multi-seller: that seller's items
            suggestedCod={parts.length === 1 ? orderTotal : p.itemsTotal}
            shipment={sh}
            settlement={sh ? settlements.find((s) => s.shipment_id === sh.id) : undefined}
            couriers={couriers}
          />
        );
      })}
    </div>
  );
}
