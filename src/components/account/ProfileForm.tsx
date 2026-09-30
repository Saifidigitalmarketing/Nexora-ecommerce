"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PK_MOBILE_RE } from "@/lib/pakistan";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", whatsapp: profile.whatsapp ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.full_name.trim().length < 2) errs.full_name = "Enter your full name";
    if (form.phone && !PK_MOBILE_RE.test(form.phone.trim())) errs.phone = "Enter a valid mobile number";
    if (form.whatsapp && !PK_MOBILE_RE.test(form.whatsapp.trim())) errs.whatsapp = "Enter a valid WhatsApp number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const { error } = await getSupabaseBrowser()
      .from("profiles")
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, whatsapp: form.whatsapp.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast(error.message, "error");
    else {
      toast("Profile saved");
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Full name" name="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
      <Input label="Email" name="email" value={profile.email ?? ""} disabled hint="Contact support to change your email." />
      <Input label="Mobile number" name="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
      <Input label="WhatsApp number" optional name="whatsapp" type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} error={errors.whatsapp} />
      <Button type="submit" size="lg" loading={saving}>
        Save changes
      </Button>
      <Link href="/reset-password" className="text-center font-label-md text-label-md text-primary">
        Change password
      </Link>
    </form>
  );
}
