"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export function RoleSelect({ userId, role, self }: { userId: string; role: UserRole; self?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(role);
  return (
    <select
      aria-label="Role"
      value={value}
      disabled={self}
      onChange={async (e) => {
        const next = e.target.value as UserRole;
        if (next === "admin" && !confirm("Give this user full admin access?")) return;
        const prev = value;
        setValue(next);
        const { error } = await getSupabaseBrowser().rpc("admin_set_user_role", { p_user: userId, p_role: next });
        if (error) {
          setValue(prev);
          toast(error.message, "error");
        } else {
          toast("Role updated");
          router.refresh();
        }
      }}
      className="bg-surface-container-low rounded-lg px-2 py-1.5 font-label-md text-label-md disabled:opacity-60"
    >
      <option value="customer">Customer</option>
      <option value="rider">Rider</option>
      <option value="admin">Admin</option>
    </select>
  );
}
