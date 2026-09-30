import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderSummaryBlocks } from "@/components/account/OrderDetail";
import { StackHeader } from "@/components/layout/StackHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth";
import { PAYMENT_LABEL } from "@/lib/orders";
import { formatDate, formatPKR } from "@/lib/format";
import { getOrderByNumber } from "@/lib/order-queries";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: number } = await searchParams;
  if (!number) notFound();
  const { userId } = await requireUser(`/checkout/success?order=${encodeURIComponent(number)}`);
  const data = await getOrderByNumber(number);
  if (!data || data.order.user_id !== userId) notFound();
  const { order, items } = data;
  const manual = order.payment_method !== "cod";

  return (
    <>
      <StackHeader title="Order Confirmed" fallbackHref="/" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-md pb-12">
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center">
            <Icon name="check" className="text-[36px]" />
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Thank you for your order!</h2>
          <p className="font-body-md text-body-md text-secondary">We&apos;ve received your order and will confirm it shortly.</p>
          <div className="mt-2 px-4 py-2 rounded-lg bg-surface-container-low">
            <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Order number</p>
            <p className="font-price-md text-price-md text-on-surface tracking-wide">{order.order_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full mt-2 tabular">
            <div className="p-2 rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-label-sm text-secondary uppercase">Total</p>
              <p className="font-label-lg text-label-lg">{formatPKR(order.total)}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-label-sm text-secondary uppercase">Payment</p>
              <p className="font-label-lg text-label-lg">{PAYMENT_LABEL[order.payment_method]}</p>
            </div>
          </div>
          {order.estimated_delivery_from ? (
            <p className="font-label-md text-label-md text-primary flex items-center gap-1 mt-1">
              <Icon name="local_shipping" className="text-[18px]" />
              Estimated delivery {formatDate(order.estimated_delivery_from, { weekday: "short", day: "numeric", month: "short" })} –{" "}
              {formatDate(order.estimated_delivery_to ?? order.estimated_delivery_from, { weekday: "short", day: "numeric", month: "short" })}
            </p>
          ) : null}
          {manual ? (
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              {order.payment_reference
                ? "We'll verify your Transaction ID and confirm your order."
                : "Please complete your payment and share the Transaction ID via Help & Support so we can confirm your order."}
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href={`/account/orders/${order.order_number}`} size="lg">
            <Icon name="local_shipping" className="text-[18px]" /> Track Order
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="lg">
            Keep shopping
          </ButtonLink>
        </div>

        <OrderSummaryBlocks order={order} items={items} />
      </main>
    </>
  );
}
