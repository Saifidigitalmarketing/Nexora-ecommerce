import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Spinner } from "./Spinner";

type Variant = "primary" | "ink" | "soft" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-tertiary-container shadow-sm",
  ink: "bg-on-surface text-surface hover:bg-primary shadow-sm",
  soft: "bg-surface-container text-on-surface hover:bg-surface-container-high shadow-sm",
  outline: "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low",
  ghost: "bg-transparent text-primary hover:bg-primary/10",
  danger: "bg-error text-on-error hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 rounded-lg font-label-md text-label-md",
  md: "h-11 px-4 rounded-lg font-label-lg text-label-lg",
  lg: "h-12 px-5 rounded-xl font-label-lg text-label-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="w-4 h-4" /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
