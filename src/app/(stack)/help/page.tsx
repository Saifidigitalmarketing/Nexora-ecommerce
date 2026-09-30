import type { Metadata } from "next";
import Link from "next/link";
import { SupportForm } from "@/components/account/SupportForm";
import { StackHeader } from "@/components/layout/StackHeader";
import { Icon } from "@/components/ui/Icon";
import { getPublicSetting } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { getSession, getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Help & Support" };

const FAQ = [
  { q: "How do I track my order?", a: "Go to Account → My Orders and open your order. You'll see every step from Order Placed to Delivered." },
  { q: "Which payment methods are available?", a: "Cash on Delivery, Easypaisa, JazzCash and Bank Transfer. For wallets and bank transfer, send the amount and enter your Transaction ID at checkout; we verify it before dispatch." },
  { q: "How much is delivery?", a: "Delivery charges depend on your city and area and are shown in your cart and at checkout before you place the order." },
  { q: "Can I cancel my order?", a: "Yes — while the order is 'Order Placed' or 'Order Confirmed' you can cancel it from the order page." },
  { q: "Are products original?", a: "NEXORA sells only through official and verified stores. PTA Approved devices are labelled on the product page." },
  { q: "How do returns work?", a: "Unused items in original packaging can be returned within 7 days of delivery. Contact support with your order number." },
];

type StoreInfo = { support_phone?: string; support_whatsapp?: string; support_email?: string };

export default async function HelpPage() {
  const [{ userId }, store] = await Promise.all([getSession(), getPublicSetting<StoreInfo>("store", {})]);
  let tickets: { id: string; subject: string; status: string; admin_reply: string | null; created_at: string }[] = [];
  if (userId) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from("support_tickets").select("id, subject, status, admin_reply, created_at").order("created_at", { ascending: false }).limit(10);
    tickets = data ?? [];
  }
  const wa = store.support_whatsapp?.replace(/\D/g, "").replace(/^0/, "92");

  return (
    <>
      <StackHeader title="Help & Support" />
      <main className="w-full max-w-2xl mx-auto px-margin py-space-md flex flex-col gap-space-md pb-12">
        <div className="grid grid-cols-3 gap-space-sm">
          {store.support_phone ? (
            <a href={`tel:${store.support_phone}`} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col items-center gap-1">
              <Icon name="call" className="text-[22px] text-primary" />
              <span className="font-label-md text-label-md">Call us</span>
            </a>
          ) : null}
          {wa ? (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col items-center gap-1">
              <Icon name="chat" className="text-[22px] text-primary" />
              <span className="font-label-md text-label-md">WhatsApp</span>
            </a>
          ) : null}
          {store.support_email ? (
            <a href={`mailto:${store.support_email}`} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col items-center gap-1">
              <Icon name="mail" className="text-[22px] text-primary" />
              <span className="font-label-md text-label-md">Email</span>
            </a>
          ) : null}
          <Link href="/account/orders" className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col items-center gap-1">
            <Icon name="local_shipping" className="text-[22px] text-primary" />
            <span className="font-label-md text-label-md">Track order</span>
          </Link>
        </div>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <h2 className="font-label-lg text-label-lg font-bold px-space-md pt-space-md pb-2">Frequently asked questions</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t border-surface-container-low px-space-md">
              <summary className="flex items-center justify-between py-3 cursor-pointer list-none font-label-lg text-label-lg text-on-surface">
                {f.q}
                <Icon name="expand_more" className="text-[20px] text-secondary transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-3 font-body-md text-body-md text-secondary">{f.a}</p>
            </details>
          ))}
        </section>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3">
          <h2 className="font-label-lg text-label-lg font-bold">Send us a message</h2>
          {userId ? (
            <SupportForm userId={userId} />
          ) : (
            <Link href="/login?next=/help" className="font-label-md text-label-md text-primary">
              Sign in to contact support
            </Link>
          )}
        </section>

        {tickets.length ? (
          <section className="flex flex-col gap-space-sm">
            <h2 className="font-label-lg text-label-lg font-bold">Your messages</h2>
            {tickets.map((t) => (
              <div key={t.id} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg">{t.subject}</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm capitalize">{t.status}</span>
                </div>
                <span className="font-body-sm text-body-sm text-secondary">{formatDate(t.created_at)}</span>
                {t.admin_reply ? <p className="font-body-md text-body-md bg-primary/5 rounded-lg p-2 mt-1">{t.admin_reply}</p> : null}
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </>
  );
}
