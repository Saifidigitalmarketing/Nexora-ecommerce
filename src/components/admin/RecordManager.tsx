"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Table, Td } from "./ui";

export type FieldType = "text" | "number" | "textarea" | "select" | "checkbox" | "datetime" | "upper";

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** empty input → null */
  nullable?: boolean;
}

export interface ColumnDef<T> {
  label: string;
  render: (row: T) => ReactNode;
}

type Row = { id: string | number };

function toInput(v: unknown, type: FieldType): string | boolean {
  if (type === "checkbox") return Boolean(v);
  if (v == null) return "";
  if (type === "datetime") {
    const d = new Date(String(v));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

function fromInput(v: string | boolean, f: FieldDef): unknown {
  const type = f.type ?? "text";
  if (type === "checkbox") return Boolean(v);
  const s = String(v).trim();
  if (s === "") return f.nullable || !f.required ? null : "";
  if (type === "number") return Number(s);
  if (type === "datetime") return new Date(s).toISOString();
  if (type === "upper") return s.toUpperCase().replace(/\s+/g, "");
  return s;
}

/** Generic admin list + create/edit sheet + delete for simple tables (RLS: admin only). */
export function RecordManager<T extends Row>({
  table,
  rows,
  fields,
  columns,
  title,
  defaults = {},
  canDelete = true,
  emptyText = "Nothing here yet.",
}: {
  table: string;
  rows: T[];
  fields: FieldDef[];
  columns: ColumnDef<T>[];
  title: string;
  defaults?: Record<string, unknown>;
  canDelete?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (row: T | "new") => {
    const src = (row === "new" ? defaults : row) as Record<string, unknown>;
    setForm(Object.fromEntries(fields.map((f) => [f.name, toInput(src[f.name], f.type ?? "text")])));
    setErrors({});
    setEditing(row);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required && (form[f.name] === "" || form[f.name] == null)) errs[f.name] = `${f.label} is required`;
      if (f.type === "number" && form[f.name] !== "" && Number.isNaN(Number(form[f.name]))) errs[f.name] = "Enter a number";
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const payload = Object.fromEntries(fields.map((f) => [f.name, fromInput(form[f.name], f)]));
    const supabase = getSupabaseBrowser();
    const { error } = editing === "new" ? await supabase.from(table).insert(payload) : await supabase.from(table).update(payload).eq("id", (editing as T).id);
    setSaving(false);
    if (error) {
      toast(error.code === "23505" ? "That value is already in use" : error.message, "error");
      return;
    }
    toast("Saved");
    setEditing(null);
    router.refresh();
  };

  const remove = async (row: T) => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const { error } = await getSupabaseBrowser().from(table).delete().eq("id", row.id);
    if (error) toast(error.code === "23503" ? "It is still used elsewhere — deactivate it instead" : error.message, "error");
    else {
      toast("Deleted");
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button size="sm" onClick={() => open("new")}>
          <Icon name="add" className="text-[18px]" /> Add {title.toLowerCase()}
        </Button>
      </div>
      <Table head={[...columns.map((c) => c.label), ""]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="hover:bg-surface-container-low/50">
            {columns.map((c) => (
              <Td key={c.label}>{c.render(r)}</Td>
            ))}
            <Td className="text-right whitespace-nowrap">
              <button type="button" aria-label="Edit" onClick={() => open(r)} className="w-8 h-8 rounded-full hover:bg-surface-container-low inline-flex items-center justify-center text-secondary">
                <Icon name="edit" className="text-[18px]" />
              </button>
              {canDelete ? (
                <button type="button" aria-label="Delete" onClick={() => void remove(r)} className="w-8 h-8 rounded-full hover:bg-error-container inline-flex items-center justify-center text-secondary hover:text-error">
                  <Icon name="delete" className="text-[18px]" />
                </button>
              ) : null}
            </Td>
          </tr>
        ))}
      </Table>
      {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">{emptyText}</p> : null}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? `Add ${title.toLowerCase()}` : `Edit ${title.toLowerCase()}`}>
        <div className="flex flex-col gap-3">
          {fields.map((f) => {
            const t = f.type ?? "text";
            const common = { name: f.name, label: f.label, hint: f.hint, error: errors[f.name], optional: !f.required, placeholder: f.placeholder };
            if (t === "checkbox")
              return (
                <label key={f.name} className="flex items-center justify-between font-body-md text-body-md">
                  {f.label}
                  <input type="checkbox" className="w-5 h-5 accent-primary" checked={Boolean(form[f.name])} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                </label>
              );
            if (t === "select")
              return (
                <Select key={f.name} {...common} value={String(form[f.name] ?? "")} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  {!f.required ? <option value="">—</option> : null}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              );
            if (t === "textarea") return <Textarea key={f.name} {...common} value={String(form[f.name] ?? "")} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />;
            return (
              <Input
                key={f.name}
                {...common}
                type={t === "datetime" ? "datetime-local" : "text"}
                inputMode={t === "number" ? "decimal" : undefined}
                value={String(form[f.name] ?? "")}
                onChange={(e) => setForm({ ...form, [f.name]: t === "upper" ? e.target.value.toUpperCase() : e.target.value })}
              />
            );
          })}
          <Button size="lg" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </Sheet>
    </>
  );
}
