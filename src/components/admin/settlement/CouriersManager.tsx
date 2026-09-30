"use client";

import { formatPKR } from "@/lib/format";
import type { Courier } from "@/lib/settlement";
import { RecordManager } from "../RecordManager";

export function CouriersManager({ rows }: { rows: Courier[] }) {
  return (
    <RecordManager
      table="couriers"
      title="Courier"
      rows={rows}
      defaults={{ is_active: true, default_charge: 0 }}
      fields={[
        { name: "name", label: "Courier name", required: true, placeholder: "TCS" },
        { name: "code", label: "Code", required: true, placeholder: "tcs", hint: "lowercase; used for future API integration (tcs, leopards, mnp, trax…)" },
        { name: "default_charge", label: "Default charge per shipment (Rs.)", type: "number", required: true },
        { name: "tracking_url_template", label: "Tracking URL template", nullable: true, placeholder: "https://…?cn={tracking}" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      columns={[
        { label: "Courier", render: (c) => <span className="font-semibold">{c.name}</span> },
        { label: "Code", render: (c) => <span className="text-secondary">{c.code}</span> },
        { label: "Default charge", render: (c) => formatPKR(c.default_charge) },
        { label: "Tracking link", render: (c) => (c.tracking_url_template ? "Configured" : "—") },
        {
          label: "Status",
          render: (c) => (
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${c.is_active ? "bg-primary/10 text-primary" : "bg-surface-container-high text-secondary"}`}>{c.is_active ? "Active" : "Inactive"}</span>
          ),
        },
      ]}
    />
  );
}
