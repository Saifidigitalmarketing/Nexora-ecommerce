"use client";

import { Icon } from "@/components/ui/Icon";

export function ExportCsv({ rows, filename }: { rows: Record<string, string | number | null>[]; filename: string }) {
  return (
    <button
      type="button"
      disabled={!rows.length}
      onClick={() => {
        const head = Object.keys(rows[0] ?? {});
        const esc = (v: unknown) => {
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="flex items-center gap-1 px-3 h-9 rounded-lg bg-surface-container font-label-md text-label-md disabled:opacity-50"
    >
      <Icon name="download" className="text-[18px]" /> Export CSV
    </button>
  );
}
