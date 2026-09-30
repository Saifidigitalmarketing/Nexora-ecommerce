"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "Incorrect email or password." : err.message);
      return;
    }
    // full navigation so server components render with the new session
    window.location.replace(next);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error ? (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={loading}>
        Sign in
      </Button>
      <div className="flex items-center justify-between font-label-md text-label-md">
        <Link href="/forgot-password" className="text-secondary hover:text-primary">
          Forgot password?
        </Link>
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary font-semibold">
          Create account
        </Link>
      </div>
    </form>
  );
}
