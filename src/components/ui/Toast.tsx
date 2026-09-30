"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon } from "./Icon";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++idRef.current;
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-margin pointer-events-none" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-[0_8px_30px_rgba(17,24,39,0.12)] font-label-md text-label-md max-w-sm",
              t.tone === "error" ? "bg-error text-on-error" : "bg-inverse-surface text-inverse-on-surface",
            )}
          >
            <Icon
              name={t.tone === "error" ? "error" : t.tone === "info" ? "info" : "check_circle"}
              className={cn("text-[18px]", t.tone === "success" && "text-inverse-primary")}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
