import type { Metadata } from "next";
import Link from "next/link";
import { StatusChip } from "@/components/account/StatusChip";
import { StackHeader } from "@/components/layout/StackHeader";
import { ProductImage } from "@/components/product/ProductImage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Order, OrderItem } from "@/lib/types";

export const metadata: Metadata = { title: "My Orders" };

export default async function OrdersPage() {
  const { userId } = await requireUser("/account/orders");
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, payment_method, items:order_items(id, product_name, image_url, quantity)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = (data ?? []) as (Pick<Order, "id" | "order_number" | "status" | "total" | "created_at"> & { items: Pick<OrderItem, "id" | "product_name" | "image_url" | "quantity">[] })[];

  return (
    <>
      <StackHeader title="My Orders" fallbackHref="/account" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-sm">
        {orders.length ? (
          orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.order_number}`} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface">{o.order_number}</p>
                  <p className="font-body-sm text-body-sm text-secondary">{formatDate(o.created_at)}</p>
                </div>
                <StatusChip status={o.status} />
              </div>
              <div className="flex items-center gap-2">
                {o.items.slice(0, 4).map((it) => (
                  <div key={it.id} className="w-12 h-12 rounded-lg bg-surface-container-low overflow-hidden">
                    <ProductImage src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
                  </div>
                ))}
                {o.items.length > 4 ? <span className="font-label-md text-label-md text-secondary">+{o.items.length - 4}</span> : null}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-secondary">{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                <span className="flex items-center gap-1 font-price-md text-price-md text-on-surface tabular">
                  {formatPKR(o.total)} <Icon name="chevron_right" className="text-[20px] text-secondary" />
                </span>
              </div>
            </Link>
          ))
        ) : (
          <EmptyState icon="receipt_long" title="No orders yet" description="When you place an order, you can track it here." action={<ButtonLink href="/">Start shopping</ButtonLink>} />
        )}
      </main>
    </>
  );
}
