"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PK_MOBILE_RE } from "@/lib/pakistan";
import { safeNext } from "@/lib/safe-redirect";

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.full_name.trim().length < 2) errs.full_name = "Enter your full name";
    if (!PK_MOBILE_RE.test(form.phone.trim())) errs.phone = "Enter a valid mobile number, e.g. 03001234567";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errs.email = "Enter a valid email";
    if (form.password.length < 8) errs.password = "Use at least 8 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError(null);
    const { data, error: err } = await getSupabaseBrowser().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), phone: form.phone.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      // full navigation so server components render with the new session
      window.location.replace(next);
    } else {
      setCheckEmail(true);
    }
  };

  if (checkEmail) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4">
        <Icon name="mark_email_read" className="text-[40px] text-primary" />
        <p className="font-label-lg text-label-lg">Confirm your email</p>
        <p className="font-body-md text-body-md text-secondary">
          We sent a link to <strong>{form.email}</strong>. Open it to activate your NEXORA account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label="Full name" name="full_name" autoComplete="name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} />
      <Input label="Mobile number" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="03XX XXXXXXX" value={form.phone} onChange={set("phone")} error={errors.phone} />
      <Input label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} error={errors.email} />
      <Input label="Password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters" />
      {error ? (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={loading}>
        Create account
      </Button>
      <p className="text-center font-label-md text-label-md text-secondary">
        Already have an account?{" "}
        <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary font-semibold">
          Sign in
        </Link>
      </p>
    </form>
  );
}
