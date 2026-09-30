"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Table, Td } from "../ui";

type CType = "percent" | "fixed";

export function CommissionSettings({ type, value }: { type: CType; value: number }) {
  const router = useRouter();
  const toast = useToast();
  const [t, setT] = useState<CType>(type);
  const [v, setV] = useState(String(value));
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
      <Select label="Default NEXORA commission" name="ctype" value={t} onChange={(e) => setT(e.target.value as CType)}>
        <option value="percent">Percentage of seller sales</option>
        <option value="fixed">Fixed amount per shipment</option>
      </Select>
      <Input label={t === "percent" ? "Rate (%)" : "Amount (Rs.)"} name="cvalue" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} />
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const supabase = getSupabaseBrowser();
          const { error } = await supabase
            .from("settlement_settings")
            .upsert({ id: 1, default_commission_type: t, default_commission_value: Number(v) || 0, updated_at: new Date().toISOString() });
          if (!error) await supabase.rpc("admin_recompute_open_settlements");
          setBusy(false);
          if (error) toast(error.message, "error");
          else {
            toast("Commission saved — open settlements recalculated");
            router.refresh();
          }
        }}
      >
        Save
      </Button>
    </div>
  );
}

export interface SellerRow {
  id: string;
  name: string;
  commission_type: CType | null;
  commission_value: number | null;
  owner_email: string | null;
}

function SellerCommission({ row }: { row: SellerRow }) {
  const router = useRouter();
  const toast = useToast();
  const [t, setT] = useState<string>(row.commission_type ?? "");
  const [v, setV] = useState(row.commission_value != null ? String(row.commission_value) : "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = getSupabaseBrowser();
  return (
    <tr>
      <Td className="font-semibold">{row.name}</Td>
      <Td>
        <div className="flex items-center gap-1">
          <select aria-label="Commission type" value={t} onChange={(e) => setT(e.target.value)} className="bg-surface-container-low rounded-lg px-2 py-1.5 font-label-md text-label-md">
            <option value="">Default</option>
            <option value="percent">%</option>
            <option value="fixed">Rs. fixed</option>
          </select>
          {t ? (
            <input aria-label="Commission value" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} className="w-20 bg-surface-container-low rounded-lg px-2 py-1.5 font-label-md text-label-md" />
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await supabase
                .from("vendors")
                .update({ commission_type: t || null, commission_value: t ? Number(v) || 0 : null })
                .eq("id", row.id);
              if (!error) await supabase.rpc("admin_recompute_open_settlements");
              setBusy(false);
              if (error) toast(error.message, "error");
              else {
                toast("Seller commission saved");
                router.refresh();
              }
            }}
            className="px-2 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md"
          >
            Save
          </button>
        </div>
      </Td>
      <Td>
        {row.owner_email ? (
          <span className="text-secondary">{row.owner_email}</span>
        ) : (
          <div className="flex items-center gap-1">
            <input aria-label="Seller account email" type="email" placeholder="seller@email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-44 bg-surface-container-low rounded-lg px-2 py-1.5 font-body-sm text-body-sm" />
            <button
              type="button"
              disabled={!email || busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await supabase.rpc("admin_link_seller", { p_vendor: row.id, p_email: email });
                setBusy(false);
                if (error) toast(error.message, "error");
                else {
                  toast("Seller account linked");
                  router.refresh();
                }
              }}
              className="px-2 py-1 rounded-lg bg-surface-container font-label-md text-label-md disabled:opacity-50"
            >
              Link
            </button>
          </div>
        )}
      </Td>
    </tr>
  );
}

export function SellersTable({ rows }: { rows: SellerRow[] }) {
  return (
    <Table head={["Seller / store", "Commission override", "Seller login"]}>
      {rows.map((r) => (
        <SellerCommission key={r.id} row={r} />
      ))}
    </Table>
  );
}
