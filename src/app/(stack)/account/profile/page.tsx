import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/ProfileForm";
import { StackHeader } from "@/components/layout/StackHeader";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile } = await requireUser("/account/profile");
  return (
    <>
      <StackHeader title="Profile & Security" fallbackHref="/account" />
      <main className="w-full max-w-md mx-auto px-margin py-space-md">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md">
          <ProfileForm profile={profile} />
        </div>
      </main>
    </>
  );
}
