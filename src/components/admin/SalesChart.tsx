import { formatPKR } from "@/lib/format";

/** Minimal bar chart (inline SVG) for the last 14 days of sales. */
export function SalesChart({ data }: { data: { day: string; total: number; orders: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Number(d.total)));
  const W = 14 * 28;
  const H = 140;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-auto" role="img" aria-label="Sales for the last 14 days">
        <line x1="0" x2={W} y1={H} y2={H} stroke="#dce2f3" />
        {data.map((d, i) => {
          const h = Math.round((Number(d.total) / max) * (H - 8));
          const x = i * 28 + 6;
          return (
            <g key={d.day}>
              <title>{`${d.day}: ${formatPKR(d.total)} · ${d.orders} orders`}</title>
              <rect x={x} y={H - h} width="16" height={Math.max(h, 1)} rx="3" fill={i === data.length - 1 ? "#006948" : "#68dba9"} />
              <text x={x + 8} y={H + 15} textAnchor="middle" fontSize="9" fill="#575e70">
                {new Date(d.day).getDate()}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">Daily revenue, most recent day highlighted.</figcaption>
    </figure>
  );
}
