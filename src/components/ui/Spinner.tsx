import { cn } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block w-5 h-5 rounded-full border-2 border-current border-r-transparent animate-spin", className)}
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-secondary">
      <Spinner className="w-6 h-6 text-primary" />
      <span className="font-label-sm text-label-sm">{label}</span>
    </div>
  );
}
