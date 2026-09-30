import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/** Server guard: returns the signed-in user or redirects to /login. */
export async function requireUser(next: string) {
  const s = await getSession();
  if (!s.userId || !s.profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { userId: s.userId, profile: s.profile };
}

/** Server guard for role-restricted areas. RLS enforces the same rule in the database. */
export async function requireRole(role: UserRole, next: string) {
  const s = await requireUser(next);
  if (s.profile.role !== role) redirect("/account?denied=1");
  return s;
}
