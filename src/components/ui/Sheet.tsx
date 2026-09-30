"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Mobile bottom sheet (12px top radius, Level 3 elevation). Centered dialog on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-surface-container-lowest rounded-t-xl sm:rounded-xl shadow-[0_8px_30px_rgba(17,24,39,0.08)] pb-safe">
        <div className="sticky top-0 bg-surface-container-lowest flex items-center justify-between px-margin pt-3 pb-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-secondary hover:bg-surface-container-low">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="px-margin pb-margin">{children}</div>
      </div>
    </div>
  );
}
