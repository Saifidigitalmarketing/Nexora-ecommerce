import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/account/CancelOrderButton";
import { OrderHeader, OrderSummaryBlocks, TrackingCard } from "@/components/account/OrderDetail";
import { StackHeader } from "@/components/layout/StackHeader";
import { requireUser } from "@/lib/auth";
import { getOrderByNumber } from "@/lib/order-queries";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

export default async function OrderPage({ params }: Props) {
  const { number } = await params;
  const { userId } = await requireUser(`/account/orders/${number}`);
  const data = await getOrderByNumber(decodeURIComponent(number));
  if (!data || data.order.user_id !== userId) notFound();
  const { order, items, history } = data;

  return (
    <>
      <StackHeader title="Order Details" fallbackHref="/account/orders" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-md pb-12">
        <OrderHeader order={order} />
        <TrackingCard order={order} history={history} />
        <OrderSummaryBlocks order={order} items={items} />
        {order.status === "placed" || order.status === "confirmed" ? <CancelOrderButton orderId={order.id} /> : null}
      </main>
    </>
  );
}
