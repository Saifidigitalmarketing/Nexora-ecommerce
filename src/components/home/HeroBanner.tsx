"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

/** Editorial hero with auto-advancing slides and pagination pills. */
export function HeroBanner({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[i];
  return (
    <section className="px-margin mt-space-sm" aria-roledescription="carousel" aria-label="Promotions">
      <div className="relative w-full rounded-xl overflow-hidden shadow-sm bg-surface-container-lowest flex flex-col justify-end min-h-[220px] lg:min-h-[320px]">
        <div className="absolute inset-0 bg-cover bg-center bg-inverse-surface transition-[background-image] duration-500" style={b.image_url ? { backgroundImage: `url("${encodeURI(b.image_url).replace(/"/g, "%22")}")` } : undefined}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        </div>
        <div className="relative z-10 p-space-md lg:p-space-xl flex flex-col gap-space-xs text-white">
          {b.badge ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/90 backdrop-blur-md self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-bright animate-pulse" />
              <span className="font-label-sm text-label-sm text-on-primary tracking-wider uppercase font-semibold">{b.badge}</span>
            </div>
          ) : null}
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile lg:font-headline-lg lg:text-headline-lg text-white leading-tight font-bold max-w-[260px] lg:max-w-md">{b.title}</h2>
          {b.subtitle ? <p className="font-body-sm text-body-sm text-surface-container-highest opacity-90">{b.subtitle}</p> : null}
          <div className="flex items-center justify-between mt-space-xs pt-1">
            {b.cta_link ? (
              <Link
                href={b.cta_link}
                className="px-4 py-2 rounded-full bg-surface-bright text-on-background hover:bg-white transition-all font-label-md text-label-md font-bold shadow-md active:scale-95"
              >
                {b.cta_label ?? "Shop Now"}
              </Link>
            ) : (
              <span />
            )}
            {banners.length > 1 ? (
              <div className="flex items-center gap-1.5 pr-1">
                {banners.map((x, n) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-label={`Show slide ${n + 1}`}
                    onClick={() => setI(n)}
                    className={n === i ? "w-5 h-1.5 rounded-full bg-surface-bright transition-all" : "w-1.5 h-1.5 rounded-full bg-white/50"}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
