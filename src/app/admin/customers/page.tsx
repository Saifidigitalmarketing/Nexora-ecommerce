import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar } from "@/components/admin/FilterBar";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { AdminPage, Card, Pager, Table, Td } from "@/components/admin/ui";
import { getSession, getSupabaseServer } from "@/lib/supabase/server";
import { formatDate, formatPKR } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };
const PAGE = 30;

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const supabase = await getSupabaseServer();
  const { userId: me } = await getSession();
  let req = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.role) req = req.eq("role", sp.role);
  if (sp.q) {
    const t = sp.q.replace(/[%,()*]/g, " ").trim();
    req = req.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`);
  }
  const { data, count } = await req;
  const users = (data ?? []) as Profile[];
  const { data: orders } = users.length
    ? await supabase.from("orders").select("user_id, total, status").in("user_id", users.map((u) => u.id))
    : { data: [] as { user_id: string; total: number; status: string }[] };
  const stats = new Map<string, { n: number; spent: number }>();
  (orders ?? []).forEach((o) => {
    const s = stats.get(o.user_id) ?? { n: 0, spent: 0 };
    s.n += 1;
    if (o.status !== "cancelled") s.spent += Number(o.total);
    stats.set(o.user_id, s);
  });
  const qs = (p: number) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`;

  return (
    <AdminPage title="Customers" subtitle="Everyone with a NEXORA account. Change a role to make someone a rider or admin.">
      <Suspense>
        <FilterBar
          param="role"
          placeholder="Name, email or phone"
          tabs={[
            { value: "", label: "All" },
            { value: "customer", label: "Customers" },
            { value: "rider", label: "Riders" },
            { value: "admin", label: "Admins" },
          ]}
        />
      </Suspense>
      <Card>
        <Table head={["Name", "Contact", "Orders", "Spent", "Joined", "Role"]}>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-surface-container-low/50">
              <Td className="font-semibold">{u.full_name || "—"}</Td>
              <Td>
                <p>{u.email}</p>
                <p className="font-body-sm text-body-sm text-secondary">{u.phone ?? ""}</p>
              </Td>
              <Td>{stats.get(u.id)?.n ?? 0}</Td>
              <Td className="tabular">{formatPKR(stats.get(u.id)?.spent ?? 0)}</Td>
              <Td className="text-secondary whitespace-nowrap">{formatDate(u.created_at)}</Td>
              <Td>
                <RoleSelect userId={u.id} role={u.role} self={u.id === me} />
              </Td>
            </tr>
          ))}
        </Table>
        {!users.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No users found.</p> : null}
        <Pager page={page} total={count ?? 0} pageSize={PAGE} hrefFor={qs} />
      </Card>
    </AdminPage>
  );
}
