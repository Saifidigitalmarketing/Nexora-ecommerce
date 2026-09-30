"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

/**
 * Image with a neutral placeholder behind it. A broken image is hidden via
 * the DOM (no React state), so a load error that happens before hydration
 * can never change the rendered tree.
 */
export function ProductImage({ src, alt, className, eager }: { src?: string | null; alt: string; className?: string; eager?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) img.style.visibility = "hidden";
  }, [src]);

  return (
    <span className="relative block w-full h-full">
      <span className="absolute inset-0 flex items-center justify-center text-outline-variant" aria-hidden>
        <Icon name="image" className="text-[36px]" />
      </span>
      {src ? (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
          onLoad={(e) => {
            e.currentTarget.style.visibility = "";
          }}
          className={cn("relative", className)}
        />
      ) : (
        <span className="sr-only">{alt}</span>
      )}
    </span>
  );
}
