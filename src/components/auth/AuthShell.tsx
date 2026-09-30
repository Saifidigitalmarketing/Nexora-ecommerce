import type { ReactNode } from "react";
import { StackHeader } from "@/components/layout/StackHeader";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <StackHeader title={title} />
      <main className="flex-1 w-full max-w-md mx-auto px-margin py-space-lg">
        <div className="flex flex-col items-center text-center gap-2 mb-space-lg">
          <img src="/icons/icon-192.png" alt="" className="w-14 h-14 rounded-xl shadow-sm" />
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          {subtitle ? <p className="font-body-md text-body-md text-secondary">{subtitle}</p> : null}
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md">{children}</div>
      </main>
    </>
  );
}
