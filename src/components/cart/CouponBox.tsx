"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";

export interface CouponResult {
  code: string;
  discount: number;
  message: string;
}

/** "Discounts & Loyalty" block — validates via validate_coupon(). */
export function CouponBox({
  code,
  subtotal,
  onChange,
}: {
  code: string | null;
  subtotal: number;
  onChange: (code: string | null, result: CouponResult | null) => void;
}) {
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<CouponResult | null>(null);

  // re-validate whenever the subtotal changes
  useEffect(() => {
    if (!code) {
      setApplied(null);
      onChange(null, null);
      return;
    }
    let cancelled = false;
    getSupabaseBrowser()
      .rpc("validate_coupon", { p_code: code, p_subtotal: subtotal })
      .then(({ data }) => {
        if (cancelled) return;
        const r = data?.[0];
        if (r?.valid) {
          const res = { code: r.code, discount: Number(r.discount), message: r.message };
          setApplied(res);
          setError(null);
          onChange(code, res);
        } else {
          setApplied(null);
          setError(r?.message ?? null);
          onChange(code, null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, subtotal]);

  const apply = async () => {
    const c = input.trim().toUpperCase();
    if (!c) return;
    setChecking(true);
    setError(null);
    const { data, error: err } = await getSupabaseBrowser().rpc("validate_coupon", { p_code: c, p_subtotal: subtotal });
    setChecking(false);
    const r = data?.[0];
    if (err || !r?.valid) {
      setError(r?.message ?? "This coupon is not valid");
      return;
    }
    setInput("");
    onChange(c, { code: r.code, discount: Number(r.discount), message: r.message });
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="confirmation_number" className="text-[18px] text-primary" />
          <span className="font-label-lg text-label-lg text-on-surface font-bold">Discounts &amp; Vouchers</span>
        </div>
        {applied ? <span className="font-label-sm text-label-sm text-primary font-semibold">1 Applied</span> : null}
      </div>
      {applied ? (
        <div className="flex items-center justify-between bg-primary/5 p-2.5 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="sell" className="text-[18px] text-primary" />
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-bold">{applied.code}</span>
              <span className="font-body-sm text-body-sm text-primary font-medium truncate">
                {applied.message} (- {formatPKR(applied.discount)})
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Remove coupon"
            onClick={() => onChange(null, null)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-secondary hover:text-on-surface"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Enter voucher code"
            aria-label="Voucher code"
            className="flex-1 min-w-0 bg-surface-container-low rounded-lg px-3 py-2 font-label-md text-label-md uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="submit" disabled={checking || !input.trim()} className="px-4 rounded-lg bg-on-surface text-surface font-label-md text-label-md disabled:opacity-50 flex items-center gap-1">
            {checking ? <Spinner className="w-4 h-4" /> : null} Apply
          </button>
        </form>
      )}
      {error && !applied ? (
        <p className="font-body-sm text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
