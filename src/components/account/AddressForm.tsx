"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Field";
import { PROVINCES, PK_MOBILE_RE } from "@/lib/pakistan";

export interface AddressValues {
  full_name: string;
  phone: string;
  province: string;
  city: string;
  area: string;
  address_line: string;
  landmark: string;
  postal_code: string;
}

export const emptyAddress = (p?: Partial<AddressValues>): AddressValues => ({
  full_name: "",
  phone: "",
  province: "Sindh",
  city: "Karachi",
  area: "",
  address_line: "",
  landmark: "",
  postal_code: "",
  ...p,
});

export function validateAddress(v: AddressValues, withContact = true): Record<string, string> {
  const e: Record<string, string> = {};
  if (withContact) {
    if (v.full_name.trim().length < 2) e.full_name = "Enter the receiver's full name";
    if (!PK_MOBILE_RE.test(v.phone.trim())) e.phone = "Enter a valid mobile number, e.g. 03001234567";
  }
  if (!v.province) e.province = "Select a province";
  if (!v.city.trim()) e.city = "Select a city";
  if (!v.area.trim()) e.area = "Enter your area / sector / block";
  if (v.address_line.trim().length < 5) e.address_line = "Enter house / flat number and street";
  if (v.postal_code && !/^\d{5}$/.test(v.postal_code.trim())) e.postal_code = "Postal code has 5 digits";
  return e;
}

/** Province → City → Area → Address → Landmark → Postal code. */
export function AddressFields({
  value,
  onChange,
  errors,
  withContact = true,
}: {
  value: AddressValues;
  onChange: (v: AddressValues) => void;
  errors: Record<string, string>;
  withContact?: boolean;
}) {
  const [customCity, setCustomCity] = useState(false);
  const cities = PROVINCES.find((p) => p.name === value.province)?.cities ?? [];
  const cityKnown = cities.includes(value.city);
  const set = (k: keyof AddressValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-3">
      {withContact ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Receiver name" name="addr_full_name" autoComplete="name" value={value.full_name} onChange={set("full_name")} error={errors.full_name} />
          <Input label="Receiver mobile" name="addr_phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" value={value.phone} onChange={set("phone")} error={errors.phone} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Province"
          name="province"
          value={value.province}
          onChange={(e) => {
            const p = PROVINCES.find((x) => x.name === e.target.value);
            setCustomCity(false);
            onChange({ ...value, province: e.target.value, city: p?.cities[0] ?? "" });
          }}
          error={errors.province}
        >
          {PROVINCES.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </Select>
        {customCity || (!cityKnown && value.city) ? (
          <Input label="City" name="city" value={value.city} onChange={set("city")} error={errors.city} />
        ) : (
          <Select
            label="City"
            name="city"
            value={value.city}
            onChange={(e) => {
              if (e.target.value === "__other") {
                setCustomCity(true);
                onChange({ ...value, city: "" });
              } else onChange({ ...value, city: e.target.value });
            }}
            error={errors.city}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other">Other city…</option>
          </Select>
        )}
      </div>
      <Input label="Area / Sector / Block" name="area" placeholder="e.g. Clifton Block 5, Gulberg III, F-7" value={value.area} onChange={set("area")} error={errors.area} />
      <Input label="Complete address" name="address_line" autoComplete="street-address" placeholder="House / flat no., street, building" value={value.address_line} onChange={set("address_line")} error={errors.address_line} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Landmark" optional name="landmark" placeholder="Near…" value={value.landmark} onChange={set("landmark")} />
        <Input label="Postal code" optional name="postal_code" inputMode="numeric" maxLength={5} value={value.postal_code} onChange={set("postal_code")} error={errors.postal_code} />
      </div>
    </div>
  );
}
