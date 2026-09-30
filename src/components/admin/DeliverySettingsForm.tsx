"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { getDeliveryQuote } from "@/lib/delivery";
import { formatPKR } from "@/lib/format";
import { PROVINCES } from "@/lib/pakistan";

export interface DeliverySettings {
  mode: "fixed" | "area" | "distance";
  base_charge: number;
  eta_min_days: number;
  eta_max_days: number;
  free_delivery_enabled: boolean;
  free_delivery_threshold: number | null;
}

export function DeliverySettingsForm({ initial }: { initial: DeliverySettings }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState({
    mode: initial.mode,
    base_charge: String(initial.base_charge),
    eta_min_days: String(initial.eta_min_days),
    eta_max_days: String(initial.eta_max_days),
    free_delivery_enabled: initial.free_delivery_enabled,
    free_delivery_threshold: initial.free_delivery_threshold != null ? String(initial.free_delivery_threshold) : "",
  });
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ province: "Sindh", city: "Karachi", area: "", subtotal: "5000" });
  const [result, setResult] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    const { error } = await getSupabaseBrowser()
      .from("delivery_settings")
      .upsert({
        id: 1,
        mode: s.mode,
        base_charge: Number(s.base_charge) || 0,
        eta_min_days: Number(s.eta_min_days) || 1,
        eta_max_days: Number(s.eta_max_days) || 1,
        free_delivery_enabled: s.free_delivery_enabled,
        free_delivery_threshold: s.free_delivery_threshold ? Number(s.free_delivery_threshold) : null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) toast(error.message, "error");
    else {
      toast("Delivery settings saved");
      router.refresh();
    }
  };

  const runTest = async () => {
    const q = await getDeliveryQuote(getSupabaseBrowser(), { ...test, subtotal: Number(test.subtotal) || 0 });
    setResult(q ? `${q.zone_name}: ${q.charge === 0 ? "FREE" : formatPKR(q.charge)} · ${q.eta_min_days}–${q.eta_max_days} days` : "Could not calculate");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
      <div className="flex flex-col gap-3">
        <Select label="Pricing mode" name="mode" value={s.mode} onChange={(e) => setS({ ...s, mode: e.target.value as DeliverySettings["mode"] })} hint="Area-based uses the zones below, falling back to the base charge.">
          <option value="fixed">Fixed — same charge everywhere</option>
          <option value="area">Area-based — zones by province / city / area</option>
          <option value="distance" disabled>
            Distance-based (coming later)
          </option>
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Base charge (Rs.)" name="base_charge" inputMode="decimal" value={s.base_charge} onChange={(e) => setS({ ...s, base_charge: e.target.value })} />
          <Input label="ETA min days" name="eta_min" inputMode="numeric" value={s.eta_min_days} onChange={(e) => setS({ ...s, eta_min_days: e.target.value })} />
          <Input label="ETA max days" name="eta_max" inputMode="numeric" value={s.eta_max_days} onChange={(e) => setS({ ...s, eta_max_days: e.target.value })} />
        </div>
        <label className="flex items-center justify-between font-body-md text-body-md">
          Free delivery over a threshold
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={s.free_delivery_enabled} onChange={(e) => setS({ ...s, free_delivery_enabled: e.target.checked })} />
        </label>
        {s.free_delivery_enabled ? (
          <Input label="Free delivery threshold (Rs.)" name="threshold" inputMode="decimal" value={s.free_delivery_threshold} onChange={(e) => setS({ ...s, free_delivery_threshold: e.target.value })} />
        ) : null}
        <Button loading={saving} onClick={() => void save()}>
          Save delivery settings
        </Button>
      </div>
      <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface-container-low">
        <p className="font-label-lg text-label-lg">Test a delivery charge</p>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Province" name="tp" value={test.province} onChange={(e) => setTest({ ...test, province: e.target.value, city: PROVINCES.find((p) => p.name === e.target.value)?.cities[0] ?? "" })}>
            {PROVINCES.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </Select>
          <Input label="City" name="tc" value={test.city} onChange={(e) => setTest({ ...test, city: e.target.value })} />
          <Input label="Area" optional name="ta" value={test.area} onChange={(e) => setTest({ ...test, area: e.target.value })} />
          <Input label="Order subtotal" name="ts" inputMode="decimal" value={test.subtotal} onChange={(e) => setTest({ ...test, subtotal: e.target.value })} />
        </div>
        <Button variant="soft" onClick={() => void runTest()}>
          Calculate
        </Button>
        {result ? <p className="font-label-lg text-label-lg text-primary">{result}</p> : null}
        <p className="font-body-sm text-body-sm text-secondary">Uses the same calculate_delivery() function as checkout (save first to test new settings).</p>
      </div>
    </div>
  );
}
