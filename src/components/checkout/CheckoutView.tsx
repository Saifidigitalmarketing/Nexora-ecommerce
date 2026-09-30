"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddressFields, emptyAddress, validateAddress, type AddressValues } from "@/components/account/AddressForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/components/providers/CartProvider";
import { useDeliveryLocation } from "@/components/providers/LocationProvider";
import { ProductImage } from "@/components/product/ProductImage";
import { CouponBox, type CouponResult } from "@/components/cart/CouponBox";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cartTotals, refreshCartItems } from "@/lib/cart-sync";
import { etaLabel, getDeliveryQuote } from "@/lib/delivery";
import { cn, formatPKR } from "@/lib/format";
import { PK_MOBILE_RE } from "@/lib/pakistan";
import type { PaymentAccounts } from "@/lib/payments";
import type { Address, DeliveryQuote, PaymentMethod, Profile } from "@/lib/types";
import { PaymentSelector } from "./PaymentSelector";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3">
      <h2 className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-sm text-label-sm flex items-center justify-center">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutView({ profile, addresses, accounts }: { profile: Profile; addresses: Address[]; accounts: PaymentAccounts }) {
  const cart = useCart();
  const router = useRouter();
  const toast = useToast();
  const { location, setLocation } = useDeliveryLocation();

  const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
  const [customer, setCustomer] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    whatsapp: profile.whatsapp ?? "",
    email: profile.email ?? "",
  });
  const [sameWhatsapp, setSameWhatsapp] = useState(!profile.whatsapp || profile.whatsapp === profile.phone);
  const [addressId, setAddressId] = useState<string | "new">(defaultAddr?.id ?? "new");
  const [newAddr, setNewAddr] = useState<AddressValues>(emptyAddress({ province: location.province, city: location.city }));
  const [saveAddress, setSaveAddress] = useState(addresses.length === 0);
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [coupon, setCouponResult] = useState<CouponResult | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  // Refresh prices once
  useEffect(() => {
    if (!cart.ready || synced) return;
    refreshCartItems(getSupabaseBrowser(), cart.items)
      .then((fresh) => cart.replace(fresh))
      .finally(() => setSynced(true));
  }, [cart.ready, synced, cart]);

  const saved = addressId !== "new" ? addresses.find((a) => a.id === addressId) : undefined;
  const addr: AddressValues = saved
    ? emptyAddress({ ...saved, landmark: saved.landmark ?? "", postal_code: saved.postal_code ?? "" })
    : newAddr;

  const totals = useMemo(() => cartTotals(cart.items), [cart.items]);
  const discount = coupon?.discount ?? 0;
  const afterDiscount = Math.max(0, totals.subtotal - discount);

  useEffect(() => {
    if (!addr.province || !addr.city) return;
    let cancelled = false;
    getDeliveryQuote(getSupabaseBrowser(), { province: addr.province, city: addr.city, area: addr.area, subtotal: afterDiscount }).then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [addr.province, addr.city, addr.area, afterDiscount]);

  if (!cart.ready || !synced) return <PageLoader label="Preparing checkout…" />;

  if (!totals.selected.length) {
    return (
      <EmptyState
        icon="shopping_bag"
        title="Nothing to check out"
        description="Select items in your cart to continue."
        action={<ButtonLink href="/cart">Go to cart</ButtonLink>}
      />
    );
  }

  const delivery = quote?.charge ?? 0;
  const total = afterDiscount + delivery;

  const placeOrder = async () => {
    setFormError(null);
    const errs: Record<string, string> = {};
    if (customer.full_name.trim().length < 2) errs.full_name = "Enter your full name";
    if (!PK_MOBILE_RE.test(customer.phone.trim())) errs.phone = "Enter a valid mobile number, e.g. 03001234567";
    const wa = sameWhatsapp ? customer.phone : customer.whatsapp;
    if (wa && !PK_MOBILE_RE.test(wa.trim())) errs.whatsapp = "Enter a valid WhatsApp number";
    if (customer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errs.email = "Enter a valid email";
    Object.assign(errs, validateAddress(addr, false));
    if (reference && !/^[A-Za-z0-9-]{4,40}$/.test(reference.trim())) errs.reference = "Transaction ID should be 4–40 letters/numbers";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please fix the highlighted fields.");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPlacing(true);
    const { data, error } = await getSupabaseBrowser().rpc("place_order", {
      p_items: totals.selected.map((i) => ({ product_id: i.productId, variant_id: i.variantId, quantity: i.quantity })),
      p_customer: { full_name: customer.full_name.trim(), phone: customer.phone.trim(), whatsapp: wa?.trim() ?? "", email: customer.email.trim() },
      p_address: {
        province: addr.province,
        city: addr.city.trim(),
        area: addr.area.trim(),
        address_line: addr.address_line.trim(),
        landmark: addr.landmark.trim(),
        postal_code: addr.postal_code.trim(),
      },
      p_payment_method: payment,
      p_payment_reference: payment === "cod" ? null : reference.trim() || null,
      p_coupon_code: coupon?.code ?? null,
      p_notes: notes.trim() || null,
      p_save_address: addressId === "new" && saveAddress,
    });
    if (error) {
      setPlacing(false);
      setFormError(error.message);
      toast(error.message, "error");
      return;
    }
    const orderNumber = (data as { order_number: string }).order_number;
    cart.clearSelected();
    cart.setCoupon(null);
    setLocation({ province: addr.province, city: addr.city });
    router.replace(`/checkout/success?order=${encodeURIComponent(orderNumber)}`);
  };

  return (
    <div className="w-full max-w-screen-lg mx-auto px-margin py-space-md pb-32 lg:grid lg:grid-cols-[1fr_380px] lg:gap-gutter-desktop lg:items-start">
      <div className="flex flex-col gap-space-md">
        <Section n={1} title="Customer information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Full name" name="full_name" autoComplete="name" value={customer.full_name} onChange={(e) => setCustomer({ ...customer, full_name: e.target.value })} error={errors.full_name} />
            <Input label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} error={errors.phone} />
          </div>
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={sameWhatsapp} onChange={(e) => setSameWhatsapp(e.target.checked)} />
            WhatsApp number is the same as mobile
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!sameWhatsapp ? (
              <Input label="WhatsApp number" optional name="whatsapp" type="tel" inputMode="tel" value={customer.whatsapp} onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })} error={errors.whatsapp} />
            ) : null}
            <Input label="Email" optional name="email" type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} error={errors.email} />
          </div>
        </Section>

        <Section n={2} title="Delivery information">
          {addresses.length ? (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Delivery address">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={addressId === a.id}
                  onClick={() => setAddressId(a.id)}
                  className={cn(
                    "text-left p-3 rounded-lg border flex gap-3 transition-colors",
                    addressId === a.id ? "border-primary border-[1.5px] bg-primary/5" : "border-outline-variant/50 hover:bg-surface-container-low",
                  )}
                >
                  <Icon name={addressId === a.id ? "radio_button_checked" : "radio_button_unchecked"} className={cn("text-[20px] mt-0.5", addressId === a.id ? "text-primary" : "text-outline")} />
                  <div className="min-w-0">
                    <p className="font-label-lg text-label-lg">
                      {a.label} {a.is_default ? <span className="font-label-sm text-label-sm text-primary">· Default</span> : null}
                    </p>
                    <p className="font-body-sm text-body-sm text-secondary">
                      {a.address_line}, {a.area}, {a.city}, {a.province}
                    </p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={addressId === "new"}
                onClick={() => setAddressId("new")}
                className={cn("text-left p-3 rounded-lg border flex items-center gap-3", addressId === "new" ? "border-primary border-[1.5px] bg-primary/5" : "border-outline-variant/50")}
              >
                <Icon name="add_location_alt" className="text-[20px] text-primary" />
                <span className="font-label-lg text-label-lg">Deliver to a new address</span>
              </button>
            </div>
          ) : null}
          {addressId === "new" ? (
            <>
              <AddressFields value={newAddr} onChange={setNewAddr} errors={errors} withContact={false} />
              <label className="flex items-center gap-2 font-body-md text-body-md">
                <input type="checkbox" className="w-4 h-4 accent-primary" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                Save this address for next time
              </label>
            </>
          ) : null}
          {quote ? (
            <p className="font-label-md text-label-md text-primary flex items-center gap-1">
              <Icon name="local_shipping" className="text-[16px]" />
              {quote.zone_name} delivery · {etaLabel(quote.eta_min_days, quote.eta_max_days)} · {quote.charge === 0 ? "FREE" : formatPKR(quote.charge)}
            </p>
          ) : null}
        </Section>

        <Section n={3} title="Payment method">
          <PaymentSelector value={payment} onChange={setPayment} accounts={accounts} total={total} reference={reference} onReference={setReference} referenceError={errors.reference} />
        </Section>

        <Section n={4} title="Order notes">
          <Textarea name="notes" optional label="Instructions for delivery" placeholder="e.g. Call before arriving" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Section>
      </div>

      <aside className="flex flex-col gap-space-md mt-space-md lg:mt-0 lg:sticky lg:top-[72px]">
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-label-lg text-label-lg font-bold">Your order ({totals.count})</h2>
            <Link href="/cart" className="font-label-md text-label-md text-primary">
              Edit
            </Link>
          </div>
          {totals.selected.map((i) => (
            <div key={i.key} className="flex gap-3">
              <div className="w-14 h-14 rounded-lg bg-surface-container-low overflow-hidden shrink-0 relative">
                <ProductImage src={i.image} alt={i.name} className="w-full h-full object-cover" />
                <span className="absolute -top-0 -right-0 min-w-[18px] h-[18px] px-1 rounded-bl-lg bg-on-surface text-surface font-label-sm text-[10px] flex items-center justify-center">{i.quantity}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-label-md text-label-md line-clamp-2">{i.name}</p>
                {i.variantLabel ? <p className="font-body-sm text-body-sm text-secondary">{i.variantLabel}</p> : null}
              </div>
              <span className="font-label-md text-label-md tabular whitespace-nowrap">{formatPKR(i.price * i.quantity)}</span>
            </div>
          ))}
        </section>

        <CouponBox
          code={cart.coupon}
          subtotal={totals.subtotal}
          onChange={(code, res) => {
            if (code !== cart.coupon) cart.setCoupon(code);
            setCouponResult(res);
          }}
        />

        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-2.5 tabular">
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-secondary">Subtotal</span>
            <span className="font-body-md text-body-md font-medium">{formatPKR(totals.subtotal)}</span>
          </div>
          {coupon ? (
            <div className="flex items-center justify-between text-primary">
              <span className="font-body-md text-body-md">Voucher ({coupon.code})</span>
              <span className="font-body-md text-body-md font-medium">- {formatPKR(coupon.discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-secondary">Delivery charge</span>
            {quote ? (
              quote.charge === 0 ? (
                <span className="font-label-md text-label-md text-primary font-bold">FREE</span>
              ) : (
                <span className="font-body-md text-body-md font-medium">{formatPKR(quote.charge)}</span>
              )
            ) : (
              <span className="font-body-md text-body-md text-secondary">—</span>
            )}
          </div>
          <div className="h-px bg-surface-container-high my-1" />
          <div className="flex items-baseline justify-between">
            <span className="font-headline-sm text-headline-sm font-bold">Grand Total</span>
            <span className="font-price-lg text-price-lg">{formatPKR(total)}</span>
          </div>
        </section>
      </aside>

      {/* Sticky place-order dock */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe">
        <div className="max-w-screen-lg mx-auto px-margin py-space-sm flex flex-col gap-1">
          {formError ? (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {formError}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col tabular">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Total Payable</span>
              <span className="font-price-md text-price-md text-on-surface">{formatPKR(total)}</span>
            </div>
            <Button variant="primary" size="lg" className="flex-1 max-w-[240px]" loading={placing} onClick={() => void placeOrder()}>
              {payment === "cod" ? "Place Order" : "Place Order & Pay"}
              <Icon name="arrow_forward" className="text-[18px]" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
