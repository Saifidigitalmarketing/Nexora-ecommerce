import { cn } from "@/lib/format";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

/** Material Symbols Outlined icon — the icon set used throughout Stitch. */
export function Icon({ name, className, filled, label, style }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", filled && "icon-fill", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      style={style}
    >
      {name}
    </span>
  );
}
