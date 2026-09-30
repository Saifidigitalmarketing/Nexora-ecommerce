"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function ResetForm() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) {
          setError("Use at least 8 characters");
          return;
        }
        setLoading(true);
        const { error: err } = await getSupabaseBrowser().auth.updateUser({ password });
        setLoading(false);
        if (err) setError(err.message);
        else {
          toast("Password updated");
          router.replace("/account");
        }
      }}
    >
      <Input label="New password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
      <Button type="submit" size="lg" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
