import Link from "next/link";
import { cn } from "@/lib/format";

/** NEXORA logo. Replace /public/brand/nexora-logo.svg with the final artwork. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="NEXORA home" className="flex items-center shrink-0">
      <img src="/brand/nexora-logo.svg" alt="NEXORA" className={cn("h-8 w-auto object-contain", className)} width={130} height={32} />
    </Link>
  );
}
