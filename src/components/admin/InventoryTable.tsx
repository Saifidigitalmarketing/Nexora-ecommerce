"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Table, Td } from "./ui";

export interface InventoryRow {
  key: string;
  table: "products" | "product_variants";
  id: string;
  productId: string;
  name: string;
  label: string | null;
  sku: string | null;
  stock: number;
}

function StockCell({ row }: { row: InventoryRow }) {
  const toast = useToast();
  const [value, setValue] = useState(String(row.stock));
  const [saved, setSaved] = useState(row.stock);
  const [busy, setBusy] = useState(false);
  const dirty = Number(value) !== saved;
  const save = async () => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setBusy(true);
    const { error } = await getSupabaseBrowser().from(row.table).update({ stock: n }).eq("id", row.id);
    setBusy(false);
    if (error) toast(error.message, "error");
    else {
      setSaved(n);
      setValue(String(n));
      toast("Stock updated");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={`Stock for ${row.name}${row.label ? ` ${row.label}` : ""}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && dirty && void save()}
        className={`w-20 rounded-lg px-2 py-1.5 bg-surface-container-low font-label-lg text-label-lg tabular focus:outline-none focus:ring-2 focus:ring-primary/30 ${saved === 0 ? "text-error" : saved <= 5 ? "text-error" : ""}`}
      />
      {dirty ? (
        <button type="button" disabled={busy} onClick={() => void save()} className="px-2 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md">
          Save
        </button>
      ) : null}
    </div>
  );
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <Table head={["Product", "Option", "SKU", "Stock"]}>
      {rows.map((r) => (
        <tr key={r.key} className="hover:bg-surface-container-low/50">
          <Td>
            <Link href={`/admin/products/${r.productId}`} className="hover:text-primary flex items-center gap-1">
              {r.table === "product_variants" ? <Icon name="subdirectory_arrow_right" className="text-[16px] text-outline" /> : null}
              {r.name}
            </Link>
          </Td>
          <Td className="text-secondary">{r.label ?? "—"}</Td>
          <Td className="text-secondary">{r.sku ?? "—"}</Td>
          <Td>
            <StockCell row={r} />
          </Td>
        </tr>
      ))}
    </Table>
  );
}
