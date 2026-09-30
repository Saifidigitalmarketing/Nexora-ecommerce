import { Icon } from "@/components/ui/Icon";

export function TrustStrip({ city }: { city?: string }) {
  return (
    <div className="w-full py-2.5 px-3 bg-surface-container-low rounded-lg shadow-sm flex items-center justify-between text-secondary gap-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon name="verified" filled className="text-[16px] text-primary" />
        <span className="font-label-sm text-label-sm text-on-surface font-medium truncate">100% Authentic</span>
      </div>
      <span className="w-1 h-1 rounded-full bg-outline-variant shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon name="electric_bolt" className="text-[16px] text-primary" />
        <span className="font-label-sm text-label-sm text-on-surface font-medium truncate">24h {city ?? "Karachi"}</span>
      </div>
      <span className="w-1 h-1 rounded-full bg-outline-variant shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon name="account_balance_wallet" className="text-[16px] text-primary" />
        <span className="font-label-sm text-label-sm text-on-surface font-medium truncate">COD &amp; JazzCash</span>
      </div>
    </div>
  );
}
