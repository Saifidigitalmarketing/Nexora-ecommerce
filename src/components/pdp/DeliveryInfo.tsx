"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useDeliveryLocation } from "@/components/providers/LocationProvider";
import { LocationPicker } from "@/components/layout/LocationPicker";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { etaLabel, getDeliveryQuote } from "@/lib/delivery";
import { formatPKR } from "@/lib/format";
import type { DeliveryQuote } from "@/lib/types";

/** Delivery & fulfilment block — live quote from calculate_delivery(). */
export function DeliveryInfo({ price }: { price: number }) {
  const { location } = useDeliveryLocation();
  const [quote, setQuote] = useState<DeliveryQuote | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setQuote(undefined);
    getDeliveryQuote(getSupabaseBrowser(), { province: location.province, city: location.city, subtotal: price }).then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [location.province, location.city, price]);

  return (
    <div className="flex flex-col p-space-md rounded-xl bg-surface-container-lowest shadow-sm gap-space-md">
      <div className="flex items-center justify-between pb-space-sm">
        <div className="flex items-center gap-2">
          <Icon name="location_on" className="text-[20px] text-primary" />
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface">Deliver to {location.city}</span>
            <span className="font-body-sm text-body-sm text-secondary">{location.province}</span>
          </div>
        </div>
        <LocationPicker variant="chip" />
      </div>
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-start gap-space-sm">
          <Icon name="electric_bolt" className="text-[20px] text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col">
            {quote === undefined ? (
              <span className="font-label-md text-label-md text-secondary">Checking delivery…</span>
            ) : quote ? (
              <>
                <span className="font-label-md text-label-md text-on-surface">
                  {quote.zone_name} delivery: {etaLabel(quote.eta_min_days, quote.eta_max_days)}
                </span>
                <span className="font-body-sm text-body-sm text-primary font-semibold">
                  {quote.charge === 0 ? "FREE delivery" : `Delivery charge ${formatPKR(quote.charge)}`}
                  {quote.free_threshold && quote.charge > 0 ? ` · Free over ${formatPKR(quote.free_threshold)}` : ""}
                </span>
              </>
            ) : (
              <span className="font-label-md text-label-md text-secondary">Delivery charges are shown at checkout</span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-space-sm">
          <Icon name="account_balance_wallet" className="text-[20px] text-secondary shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface">Payment Options</span>
            <span className="font-body-sm text-body-sm text-secondary">Cash on Delivery, Easypaisa, JazzCash, Bank Transfer</span>
          </div>
        </div>
        <div className="flex items-start gap-space-sm">
          <Icon name="assignment_return" className="text-[20px] text-secondary shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface">7-Day Easy Returns</span>
            <span className="font-body-sm text-body-sm text-secondary">Return unused items in original packaging</span>
          </div>
        </div>
      </div>
    </div>
  );
}
