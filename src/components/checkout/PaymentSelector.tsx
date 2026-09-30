"use client";

import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { PAYMENT_OPTIONS, type PaymentAccounts } from "@/lib/payments";
import { cn, formatPKR } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

/** Selectable payment tiles (active: emerald border + tint + check). */
export function PaymentSelector({
  value,
  onChange,
  accounts,
  total,
  reference,
  onReference,
  referenceError,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  accounts: PaymentAccounts;
  total: number;
  reference: string;
  onReference: (v: string) => void;
  referenceError?: string;
}) {
  const option = PAYMENT_OPTIONS.find((o) => o.id === value);
  const acct =
    value === "easypaisa" ? accounts.easypaisa : value === "jazzcash" ? accounts.jazzcash : undefined;
  const bank = value === "bank_transfer" ? accounts.bank_transfer : undefined;

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Payment method">
      {PAYMENT_OPTIONS.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!o.enabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg text-left transition-colors border",
              active ? "border-primary bg-primary/5 border-[1.5px]" : "border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low",
              !o.enabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", active ? "bg-primary text-on-primary" : "bg-surface-container-low text-primary")}>
              <Icon name={o.icon} className="text-[20px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface">{o.label}</p>
              <p className="font-body-sm text-body-sm text-secondary">{o.description}</p>
            </div>
            {active ? <Icon name="check_circle" filled className="text-[22px] text-primary" /> : <span className="w-5 h-5 rounded-full border-2 border-outline-variant" />}
          </button>
        );
      })}

      {option?.kind === "manual" ? (
        <div className="mt-1 p-3 rounded-lg bg-surface-container-low flex flex-col gap-3">
          <p className="font-body-md text-body-md text-on-surface">
            Send <strong className="tabular">{formatPKR(total)}</strong> to:
          </p>
          {acct ? (
            acct.number ? (
              <div className="font-body-md text-body-md">
                <p>
                  <span className="text-secondary">Account title:</span> {acct.title}
                </p>
                <p className="tabular">
                  <span className="text-secondary">{option.label} number:</span> <strong>{acct.number}</strong>
                </p>
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-secondary">Account details will be shared by our team after you place the order.</p>
            )
          ) : null}
          {bank ? (
            bank.account_number || bank.iban ? (
              <div className="font-body-md text-body-md">
                {bank.bank ? <p><span className="text-secondary">Bank:</span> {bank.bank}</p> : null}
                <p><span className="text-secondary">Account title:</span> {bank.title}</p>
                {bank.account_number ? <p className="tabular"><span className="text-secondary">Account no:</span> <strong>{bank.account_number}</strong></p> : null}
                {bank.iban ? <p className="tabular"><span className="text-secondary">IBAN:</span> <strong>{bank.iban}</strong></p> : null}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-secondary">Bank details will be shared by our team after you place the order.</p>
            )
          ) : null}
          <Input
            label="Transaction ID (TID)"
            optional
            name="payment_reference"
            value={reference}
            maxLength={40}
            onChange={(e) => onReference(e.target.value)}
            error={referenceError}
            hint="Add it now or share it later from Help & Support. We verify payment before dispatch."
          />
        </div>
      ) : null}
    </div>
  );
}
