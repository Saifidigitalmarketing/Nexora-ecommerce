"use client";

import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="w-full flex items-center gap-3 px-space-md py-3.5 text-error font-label-lg text-label-lg hover:bg-error-container/40 transition-colors"
    >
      <Icon name="logout" className="text-[20px]" />
      Logout
    </button>
  );
}
