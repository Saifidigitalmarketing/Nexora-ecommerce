import type { Metadata } from "next";
import { AdminMobileBar, AdminSidebar } from "@/components/admin/AdminNav";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · NEXORA Admin" }, robots: { index: false } };

/** Admin area. Access is checked here and enforced again by RLS / RPC role checks. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "/admin");
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminMobileBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
