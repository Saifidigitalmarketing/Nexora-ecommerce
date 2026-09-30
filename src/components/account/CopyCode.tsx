"use client";

import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/ui/Toast";

export function ApplyCouponButton({ code }: { code: string }) {
  const { setCoupon } = useCart();
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        setCoupon(code);
        void navigator.clipboard?.writeText(code).catch(() => {});
        toast(`${code} will be applied to your cart`);
      }}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md"
    >
      <Icon name="sell" className="text-[16px]" /> Use
    </button>
  );
}
