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
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState<"idle" | "sending" | "sent">("idle");
  const notice =
    params.get("confirmed") === "1"
      ? "Your email is confirmed. Sign in to continue."
      : params.get("error")
        ? "This link has expired or was already used. Sign in below, or request a new confirmation email."
        : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      if (/email not confirmed/i.test(err.message)) {
        setUnconfirmed(true);
        setError("Please confirm your email first — open the link we sent you.");
      } else {
        setError(err.message === "Invalid login credentials" ? "Incorrect email or password." : err.message);
      }
      return;
    }
    // full navigation so server components render with the new session
    window.location.replace(next);
  };

  const resend = async () => {
    setResent("sending");
    const { error: err } = await getSupabaseBrowser().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next === "/" ? "/account" : next)}` },
    });
    if (err) {
      setResent("idle");
      setError(err.message);
    } else setResent("sent");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {notice ? (
        <p role="status" className="p-space-sm rounded-lg bg-primary/10 text-primary font-label-md text-label-md">
          {notice}
        </p>
      ) : null}
      <Input label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error ? (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
      {unconfirmed ? (
        <Button variant="outline" loading={resent === "sending"} disabled={resent === "sent"} onClick={() => void resend()}>
          {resent === "sent" ? "Confirmation email sent" : "Resend confirmation email"}
        </Button>
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
