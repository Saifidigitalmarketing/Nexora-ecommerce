"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/format";

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const { userId } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<{ id: string; rating: number; title: string | null; body: string | null } | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getSupabaseBrowser()
      .from("reviews")
      .select("id, rating, title, body")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setRating(data.rating);
          setTitle(data.title ?? "");
          setBody(data.body ?? "");
        }
      });
  }, [userId, productId]);

  if (!userId) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/product/${slug}#reviews`)}`} className="text-center font-label-md text-label-md text-primary py-2 hover:underline">
        Sign in to write a review
      </Link>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon name="rate_review" className="text-[18px]" /> {existing ? "Edit your review" : "Write a review"}
      </Button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 5) {
      setError("Please write at least a few words.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const payload = { rating, title: title.trim() || null, body: body.trim() };
    const { error: err } = existing
      ? await supabase.from("reviews").update(payload).eq("id", existing.id)
      : await supabase.from("reviews").insert({ ...payload, product_id: productId, user_id: userId });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast("Thanks for your review!");
    setOpen(false);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} stars`} onClick={() => setRating(i)}>
            <Icon name="star" filled={i <= rating} className={cn("text-[28px]", i <= rating ? "text-amber-500" : "text-outline-variant")} />
          </button>
        ))}
      </div>
      <Input label="Title" optional name="title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Your review" name="body" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} error={error} />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={saving}>
          Submit review
        </Button>
      </div>
    </form>
  );
}
