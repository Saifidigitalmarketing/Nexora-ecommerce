"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Address } from "@/lib/types";
import { AddressFields, emptyAddress, validateAddress, type AddressValues } from "./AddressForm";

export function AddressBook({ addresses, userId }: { addresses: Address[]; userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [value, setValue] = useState<AddressValues>(emptyAddress());
  const [label, setLabel] = useState("Home");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (a: Address | "new") => {
    setEditing(a);
    setErrors({});
    if (a === "new") {
      setValue(emptyAddress());
      setLabel("Home");
      setIsDefault(addresses.length === 0);
    } else {
      setValue(emptyAddress({ ...a, landmark: a.landmark ?? "", postal_code: a.postal_code ?? "" }));
      setLabel(a.label);
      setIsDefault(a.is_default);
    }
  };

  const save = async () => {
    const errs = validateAddress(value);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const row = {
      user_id: userId,
      label: label.trim() || "Home",
      full_name: value.full_name.trim(),
      phone: value.phone.trim(),
      province: value.province,
      city: value.city.trim(),
      area: value.area.trim(),
      address_line: value.address_line.trim(),
      landmark: value.landmark.trim() || null,
      postal_code: value.postal_code.trim() || null,
      is_default: isDefault,
    };
    const { error } = editing === "new" ? await supabase.from("addresses").insert(row) : await supabase.from("addresses").update(row).eq("id", (editing as Address).id);
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Address saved");
    setEditing(null);
    router.refresh();
  };

  const remove = async (a: Address) => {
    if (!confirm("Delete this address?")) return;
    const { error } = await getSupabaseBrowser().from("addresses").delete().eq("id", a.id);
    if (error) toast(error.message, "error");
    else router.refresh();
  };

  return (
    <div className="flex flex-col gap-space-sm">
      {addresses.map((a) => (
        <div key={a.id} className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name={a.label.toLowerCase() === "office" ? "work" : "home"} className="text-[18px] text-primary" />
              <span className="font-label-lg text-label-lg">{a.label}</span>
              {a.is_default ? <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">Default</span> : null}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Edit address" onClick={() => open(a)} className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center text-secondary">
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button type="button" aria-label="Delete address" onClick={() => void remove(a)} className="w-8 h-8 rounded-full hover:bg-error-container flex items-center justify-center text-secondary hover:text-error">
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          </div>
          <p className="font-body-md text-body-md">
            {a.full_name} · {a.phone}
          </p>
          <p className="font-body-sm text-body-sm text-secondary">
            {a.address_line}, {a.area}, {a.city}, {a.province}
            {a.landmark ? ` (Near ${a.landmark})` : ""}
          </p>
        </div>
      ))}
      {!addresses.length ? <EmptyState icon="home_pin" title="No saved addresses" description="Save an address for faster checkout." /> : null}
      <Button size="lg" onClick={() => open("new")}>
        <Icon name="add" className="text-[20px]" /> Add new address
      </Button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New address" : "Edit address"}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {["Home", "Office", "Other"].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(l)}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${label === l ? "bg-primary text-on-primary" : "bg-surface-container-low"}`}
              >
                {l}
              </button>
            ))}
          </div>
          {label !== "Home" && label !== "Office" ? <Input label="Label" name="label" value={label === "Other" ? "" : label} onChange={(e) => setLabel(e.target.value || "Other")} /> : null}
          <AddressFields value={value} onChange={setValue} errors={errors} />
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default address
          </label>
          <Button size="lg" loading={saving} onClick={() => void save()}>
            Save address
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
