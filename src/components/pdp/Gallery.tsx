"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { ProductImage } from "@/components/product/ProductImage";
import type { ProductImage as Img } from "@/lib/types";

/** Swipeable hero gallery with dots, counter and zoom (Stitch product details). */
export function Gallery({ images, name, officialTag }: { images: Img[]; name: string; officialTag?: boolean }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const list = images.length ? images : [{ id: "none", url: "", alt: name, sort_order: 0 }];

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative w-full bg-surface-container-lowest flex flex-col items-center pt-space-md pb-space-sm overflow-hidden lg:rounded-xl lg:shadow-sm">
      <div className="relative w-full h-80 lg:h-[420px]">
        <div
          ref={track}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {list.map((img, i) => (
            <div key={img.id} className="w-full h-full shrink-0 snap-center px-margin flex items-center justify-center">
              <ProductImage src={img.url} alt={img.alt ?? name} eager={i === 0} className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Zoom image"
          onClick={() => setZoom(true)}
          className="absolute top-2 right-4 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-sm flex items-center justify-center text-on-surface-variant hover:text-primary transition-all"
        >
          <Icon name="zoom_in" className="text-[18px]" />
        </button>
        {officialTag ? (
          <div className="absolute top-2 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/15 text-primary shadow-sm">
            <Icon name="verified" filled className="text-[15px]" />
            <span className="font-label-sm text-label-sm">Official Stock</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between w-full px-margin mt-space-sm">
        <div className="flex items-center gap-1.5">
          {list.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Image ${i + 1}`}
              onClick={() => goTo(i)}
              className={i === index ? "w-5 h-1.5 rounded-full bg-primary transition-all" : "w-1.5 h-1.5 rounded-full bg-surface-container-highest transition-all"}
            />
          ))}
        </div>
        <div className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
          {index + 1} / {list.length}
        </div>
      </div>
      <Sheet open={zoom} onClose={() => setZoom(false)} title={name}>
        <div className="w-full aspect-square bg-surface-container-low rounded-lg overflow-hidden">
          <ProductImage src={list[index]?.url} alt={name} className="w-full h-full object-contain" />
        </div>
      </Sheet>
    </div>
  );
}
