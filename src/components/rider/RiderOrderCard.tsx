import Link from "next/link";
import { StatusChip } from "@/components/account/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatDateTime, formatPKR } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { RiderActions } from "./RiderActions";

export function mapsUrl(o: Pick<Order, "address_line" | "area" | "city" | "province">) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address_line}, ${o.area}, ${o.city}, ${o.province}, Pakistan`)}`;
}

export function waUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "92")}`;
}

export function RiderOrderCard({ order, items, compact }: { order: Order; items: OrderItem[]; compact?: boolean }) {
  const collect = order.payment_method === "cod" && order.payment_status !== "paid";
  return (
    <article className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/rider/orders/${order.id}`} className="font-label-lg text-label-lg text-on-surface">
          {order.order_number}
        </Link>
        <StatusChip status={order.status} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-label-lg text-label-lg flex items-center gap-1.5">
          <Icon name="person" className="text-[18px] text-primary" /> {order.customer_name}
        </p>
        <p className="font-body-md text-body-md text-on-surface-variant flex items-start gap-1.5">
          <Icon name="location_on" className="text-[18px] text-primary mt-0.5" />
          <span>
            {order.address_line}, {order.area}, {order.city}
            {order.landmark ? <span className="text-secondary"> (Near {order.landmark})</span> : null}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={`tel:${order.customer_phone}`} className="h-11 rounded-lg bg-surface-container flex items-center justify-center gap-1 font-label-md text-label-md">
          <Icon name="call" className="text-[18px] text-primary" /> Call
        </a>
        <a href={waUrl(order.customer_whatsapp ?? order.customer_phone)} target="_blank" rel="noopener noreferrer" className="h-11 rounded-lg bg-surface-container flex items-center justify-center gap-1 font-label-md text-label-md">
          <Icon name="chat" className="text-[18px] text-primary" /> WhatsApp
        </a>
        <a href={mapsUrl(order)} target="_blank" rel="noopener noreferrer" className="h-11 rounded-lg bg-surface-container flex items-center justify-center gap-1 font-label-md text-label-md">
          <Icon name="navigation" className="text-[18px] text-primary" /> Navigate
        </a>
      </div>

      {!compact ? (
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-container-low">
          {items.map((i) => (
            <p key={i.id} className="font-body-md text-body-md flex justify-between gap-2">
              <span>
                {i.quantity} × {i.product_name}
                {i.variant_label ? <span className="text-secondary"> ({i.variant_label})</span> : null}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-secondary">{items.reduce((n, i) => n + i.quantity, 0)} items</p>
      )}

      <div className="grid grid-cols-2 gap-2 tabular">
        <div className="p-2 rounded-lg bg-surface-container-low">
          <p className="font-label-sm text-label-sm text-secondary uppercase">Order total</p>
          <p className="font-label-lg text-label-lg">{formatPKR(order.total)}</p>
          <p className="font-body-sm text-body-sm text-secondary">incl. delivery {formatPKR(order.delivery_charge)}</p>
        </div>
        <div className={`p-2 rounded-lg ${collect ? "bg-primary/10" : "bg-surface-container-low"}`}>
          <p className="font-label-sm text-label-sm text-secondary uppercase">{PAYMENT_LABEL[order.payment_method]}</p>
          <p className={`font-label-lg text-label-lg ${collect ? "text-primary" : ""}`}>{collect ? `Collect ${formatPKR(order.total)}` : "Already paid"}</p>
        </div>
      </div>

      {order.notes ? <p className="font-body-sm text-body-sm p-2 rounded-lg bg-surface-container-low">Note: {order.notes}</p> : null}
      {order.status === "delivered" && order.delivered_at ? (
        <p className="font-body-sm text-body-sm text-primary flex items-center gap-1">
          <Icon name="check_circle" className="text-[16px]" /> Delivered {formatDateTime(order.delivered_at)}
        </p>
      ) : (
        <RiderActions order={order} />
      )}
    </article>
  );
}
