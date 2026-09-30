import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
      <ForgotForm />
    </AuthShell>
  );
}
