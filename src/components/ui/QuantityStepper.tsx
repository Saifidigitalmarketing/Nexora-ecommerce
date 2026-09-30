"use client";

import { Icon } from "./Icon";

export function QuantityStepper({
  value,
  min = 1,
  max = 20,
  onChange,
  size = "sm",
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  const btn = size === "md" ? "w-9 h-9" : "w-6 h-6";
  return (
    <div className="flex items-center gap-2 bg-surface-container-lowest shadow-sm rounded-lg px-1.5 py-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        className={`${btn} flex items-center justify-center text-secondary hover:text-on-surface disabled:opacity-40`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Icon name="remove" className="text-[16px]" />
      </button>
      <span className="font-label-md text-label-md text-on-surface font-semibold min-w-[1.25rem] text-center tabular" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={`${btn} flex items-center justify-center text-secondary hover:text-on-surface disabled:opacity-40`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Icon name="add" className="text-[16px]" />
      </button>
    </div>
  );
}
