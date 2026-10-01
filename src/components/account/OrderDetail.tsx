import Link from "next/link";
import { ProductImage } from "@/components/product/ProductImage";
import { Icon } from "@/components/ui/Icon";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatDate, formatDateTime, formatPKR } from "@/lib/format";
import type { Order, OrderItem, OrderStatusEvent } from "@/lib/types";
import { OrderTimeline } from "./OrderTimeline";
import { PaymentChip, StatusChip } from "./StatusChip";

export function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: "primary" }) {
  return (
    <div className={`flex items-center justify-between ${tone === "primary" ? "text-primary" : ""}`}>
      <span className={`font-body-md text-body-md ${tone ? "" : "text-secondary"}`}>{label}</span>
      <span className={strong ? "font-price-md text-price-md text-on-surface" : "font-body-md text-body-md font-medium"}>{value}</span>
    </div>
  );
}

/** Items, totals, delivery, payment — shared by customer order page and confirmation. */
export function OrderSummaryBlocks({ order, items }: { order: Order; items: OrderItem[] }) {
  return (
    <>
      <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3">
        <h3 className="font-label-lg text-label-lg text-on-surface font-bold">Items ({items.reduce((n, i) => n + i.quantity, 0)})</h3>
        {items.map((it) => (
          <div key={it.id} className="flex gap-3">
            <div className="w-16 h-16 rounded-lg bg-surface-container-low overflow-hidden shrink-0">
              <ProductImage src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface line-clamp-2">{it.product_name}</p>
              {it.variant_label ? <p className="font-body-sm text-body-sm text-secondary">{it.variant_label}</p> : null}
              <p className="font-body-sm text-body-sm text-secondary tabular">
                {it.quantity} × {formatPKR(it.unit_price)}
              </p>
            </div>
            <span className="font-label-lg text-label-lg tabular">{formatPKR(it.line_total)}</span>
          </div>
        ))}
        <div className="h-px bg-surface-container-high" />
        <div className="flex flex-col gap-2 tabular">
          <Row label="Subtotal" value={formatPKR(order.subtotal)} />
          {Number(order.discount_total) > 0 ? <Row tone="primary" label={`Voucher${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={`- ${formatPKR(order.discount_total)}`} /> : null}
          <Row label="Delivery" value={Number(order.delivery_charge) === 0 ? "FREE" : formatPKR(order.delivery_charge)} />
          <Row label="Total" value={formatPKR(order.total)} strong />
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-2">
        <h3 className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-1.5">
          <Icon name="location_on" className="text-[18px] text-primary" /> Delivery address
        </h3>
        <p className="font-body-md text-body-md text-on-surface">
          {order.customer_name} · {order.customer_phone}
        </p>
        <p className="font-body-md text-body-md text-secondary">
          {order.address_line}, {order.area}, {order.city}, {order.province}
          {order.postal_code ? ` ${order.postal_code}` : ""}
          {order.landmark ? ` (Near ${order.landmark})` : ""}
        </p>
        {order.estimated_delivery_from ? (
          <p className="font-label-md text-label-md text-primary flex items-center gap-1">
            <Icon name="schedule" className="text-[16px]" />
            Estimated delivery: {formatDate(order.estimated_delivery_from, { day: "numeric", month: "short" })} – {formatDate(order.estimated_delivery_to ?? order.estimated_delivery_from, { day: "numeric", month: "short" })}
          </p>
        ) : null}
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-2">
        <h3 className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-1.5">
          <Icon name="account_balance_wallet" className="text-[18px] text-primary" /> Payment
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-body-md text-body-md">{PAYMENT_LABEL[order.payment_method]}</span>
          <PaymentChip status={order.payment_status} method={order.payment_method} />
        </div>
        {order.payment_reference ? <p className="font-body-sm text-body-sm text-secondary">Transaction ID: {order.payment_reference}</p> : null}
      </section>
    </>
  );
}

export function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex items-center justify-between gap-2">
      <div>
        <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Order</p>
        <p className="font-headline-sm text-headline-sm text-on-surface">{order.order_number}</p>
        <p className="font-body-sm text-body-sm text-secondary">Placed {formatDateTime(order.created_at)}</p>
      </div>
      <StatusChip status={order.status} />
    </div>
  );
}

export function TrackingCard({ order, history }: { order: Order; history: OrderStatusEvent[] }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-label-lg text-label-lg text-on-surface font-bold">Order tracking</h3>
        <Link href="/help" className="font-label-md text-label-md text-primary">
          Need help?
        </Link>
      </div>
      <OrderTimeline status={order.status} history={history} />
    </section>
  );
}
