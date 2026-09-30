import { cn } from "@/lib/format";

type Tone = "emerald" | "soft" | "neutral" | "error" | "outline";

const TONES: Record<Tone, string> = {
  emerald: "bg-primary-fixed text-on-primary-fixed",
  soft: "bg-primary/10 text-primary",
  neutral: "bg-surface-container-high text-on-surface-variant",
  error: "bg-error-container text-on-error-container",
  outline: "bg-surface-container-lowest text-secondary border border-outline-variant/60",
};

export function Badge({ tone = "soft", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Pick badge tone by meaning, following the Stitch product cards. */
export function badgeTone(badge: string): Tone {
  const b = badge.toLowerCase();
  if (b.includes("pta") || b.includes("warranty") || b.includes("official")) return "emerald";
  if (b.includes("new")) return "soft";
  return "neutral";
}
