import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell title="Join NEXORA" subtitle="Everything. One Place. Create your account in seconds.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
