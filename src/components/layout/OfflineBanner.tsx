"use client";

import { Icon } from "@/components/ui/Icon";
import { usePwa } from "@/components/providers/PwaProvider";

export function OfflineBanner() {
  const { online } = usePwa();
  if (online) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[80] pt-safe bg-inverse-surface text-inverse-on-surface">
      <div className="flex items-center justify-center gap-2 py-1.5 font-label-md text-label-md">
        <Icon name="cloud_off" className="text-[16px]" /> You are offline. Some features may not work.
      </div>
    </div>
  );
}
