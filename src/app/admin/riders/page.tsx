import type { Metadata } from "next";
import { AddRider, EditRider } from "@/components/admin/RiderTools";
import { AdminPage, Card, Table, Td } from "@/components/admin/ui";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Riders" };

export default async function AdminRiders() {
  const supabase = await getSupabaseServer();
  const [{ data: riders }, { data: orders }] = await Promise.all([
    supabase.from("riders").select("*, profile:profiles(full_name, email, phone, role)").order("created_at"),
    supabase.from("orders").select("rider_id, status").not("rider_id", "is", null),
  ]);
  type R = { id: string; vehicle_type: string; vehicle_number: string | null; cnic: string | null; zone_city: string | null; is_active: boolean; profile: { full_name: string | null; email: string | null; phone: string | null; role: string } | null };
  const list = ((riders ?? []) as unknown as R[]).filter((r) => r.profile?.role === "rider");
  const active = new Map<string, number>();
  const done = new Map<string, number>();
  (orders ?? []).forEach((o) => {
    const m = ["assigned", "picked_up", "on_the_way"].includes(o.status) ? active : o.status === "delivered" ? done : null;
    if (m && o.rider_id) m.set(o.rider_id, (m.get(o.rider_id) ?? 0) + 1);
  });
  return (
    <AdminPage title="Riders" subtitle="Riders only ever see orders assigned to them.">
      <Card title="Add a rider">
        <AddRider />
      </Card>
      <Card title={`Riders (${list.length})`}>
        <Table head={["Rider", "Phone", "Vehicle", "Zone", "Active orders", "Delivered", "Status", ""]}>
          {list.map((r) => (
            <tr key={r.id}>
              <Td>
                <p className="font-semibold">{r.profile?.full_name || "—"}</p>
                <p className="font-body-sm text-body-sm text-secondary">{r.profile?.email}</p>
              </Td>
              <Td>{r.profile?.phone ?? "—"}</Td>
              <Td>
                {r.vehicle_type}
                {r.vehicle_number ? ` · ${r.vehicle_number}` : ""}
              </Td>
              <Td>{r.zone_city ?? "—"}</Td>
              <Td>{active.get(r.id) ?? 0}</Td>
              <Td>{done.get(r.id) ?? 0}</Td>
              <Td>
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${r.is_active ? "bg-primary/10 text-primary" : "bg-surface-container-high text-secondary"}`}>{r.is_active ? "Active" : "Inactive"}</span>
              </Td>
              <Td>
                <EditRider rider={r} />
              </Td>
            </tr>
          ))}
        </Table>
        {!list.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No riders yet.</p> : null}
      </Card>
    </AdminPage>
  );
}
