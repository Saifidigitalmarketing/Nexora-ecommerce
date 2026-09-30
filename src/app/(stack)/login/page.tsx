import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, save addresses and check out faster.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
