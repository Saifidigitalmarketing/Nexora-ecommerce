const pkr = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Rs. 54,999 — the price format used across the Stitch screens. */
export function formatPKR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return `Rs. ${pkr.format(Math.round(Number.isFinite(n) ? n : 0))}`;
}

/** 68,000 — used for struck-through compare prices. */
export function formatNumber(value: number | string | null | undefined): string {
  return pkr.format(Math.round(Number(value ?? 0)));
}

export function discountPercent(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", ...opts }).format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return formatDate(value, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function initials(name?: string | null): string {
  if (!name) return "N";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "N";
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
