"use client";

import { useEffect, useState } from "react";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** Live HH:MM:SS countdown to the soonest-ending flash deal. */
export function Countdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    setLeft(end - Date.now());
    const t = setInterval(() => setLeft(end - Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  return (
    <span className="tabular" suppressHydrationWarning>
      {left == null ? "--:--:--" : fmt(left)}
    </span>
  );
}
