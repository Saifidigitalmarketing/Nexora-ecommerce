"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return <p className="font-body-md text-body-md text-center">If an account exists for {email}, a reset link is on its way.</p>;
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error: err } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        setLoading(false);
        if (err) setError(err.message);
        else setSent(true);
      }}
    >
      <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required error={error} />
      <Button type="submit" size="lg" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
