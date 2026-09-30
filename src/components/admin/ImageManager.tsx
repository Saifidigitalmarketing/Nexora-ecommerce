"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface EditableImage {
  id?: string;
  url: string;
}

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;

/** Upload to Supabase Storage (admin-only write policy) or paste a URL. */
export function ImageManager({ images, onChange, folder = "products" }: { images: EditableImage[]; onChange: (imgs: EditableImage[]) => void; folder?: string }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const supabase = getSupabaseBrowser();
    const added: EditableImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast(`${file.name} is not an image`, "error");
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast(`${file.name} is larger than 5 MB`, "error");
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        toast(error.message, "error");
        continue;
      }
      added.push({ url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
    }
    setUploading(false);
    if (added.length) onChange([...images, ...added]);
    if (input.current) input.current.value = "";
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {images.map((img, i) => (
          <div key={img.id ?? img.url} className="relative aspect-square rounded-lg bg-surface-container-low overflow-hidden group">
            <img src={img.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            {i === 0 ? <span className="absolute top-1 left-1 px-1.5 rounded bg-primary text-on-primary font-label-sm text-[9px]">Cover</span> : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/50 to-transparent">
              <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="w-6 h-6 rounded bg-white/90 flex items-center justify-center">
                <Icon name="chevron_left" className="text-[16px]" />
              </button>
              <button type="button" aria-label="Remove image" onClick={() => onChange(images.filter((_, k) => k !== i))} className="w-6 h-6 rounded bg-white/90 text-error flex items-center justify-center">
                <Icon name="delete" className="text-[16px]" />
              </button>
              <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="w-6 h-6 rounded bg-white/90 flex items-center justify-center">
                <Icon name="chevron_right" className="text-[16px]" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="aspect-square rounded-lg border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-secondary hover:border-primary hover:text-primary"
        >
          {uploading ? <Spinner /> : <Icon name="add_photo_alternate" className="text-[28px]" />}
          <span className="font-label-sm text-label-sm mt-1">Upload</span>
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste an image URL (https://)"
          aria-label="Image URL"
          className="flex-1 min-w-0 bg-surface-container-low rounded-lg px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => {
            if (!/^https:\/\/\S+$/.test(url.trim())) {
              toast("Enter a valid https:// URL", "error");
              return;
            }
            onChange([...images, { url: url.trim() }]);
            setUrl("");
          }}
          className="px-3 rounded-lg bg-surface-container font-label-md text-label-md"
        >
          Add
        </button>
      </div>
    </div>
  );
}
