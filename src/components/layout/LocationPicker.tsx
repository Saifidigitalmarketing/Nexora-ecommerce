"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useDeliveryLocation } from "@/components/providers/LocationProvider";
import { PROVINCES } from "@/lib/pakistan";
import { cn } from "@/lib/format";

const SHORT: Record<string, string> = { "Islamabad Capital Territory": "ICT" };

export function LocationPicker() {
  const { location, setLocation } = useDeliveryLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 pl-1 min-h-[44px]"
        aria-label={`Delivery location: ${location.city}. Change`}
      >
        <Icon name="location_on" className="text-[18px] text-primary" />
        <span className="font-label-md text-label-md text-on-surface truncate max-w-[120px]">{location.city}, PK</span>
        <Icon name="expand_more" className="text-[16px] text-secondary" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Deliver to">
        <p className="font-body-sm text-body-sm text-secondary mb-3">Choose your city to see delivery charges and times.</p>
        <div className="flex flex-col gap-4">
          {PROVINCES.map((p) => (
            <div key={p.name}>
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mb-2">{SHORT[p.name] ?? p.name}</p>
              <div className="flex flex-wrap gap-2">
                {p.cities.map((c) => {
                  const active = c === location.city;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setLocation({ province: p.name, city: c });
                        setOpen(false);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-colors",
                        active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-surface-container",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
