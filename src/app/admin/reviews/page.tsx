import type { Metadata } from "next";
import Link from "next/link";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { AdminPage, Card, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviews() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("reviews").select("*, product:products(name, slug)").order("created_at", { ascending: false }).limit(200);
  type R = { id: string; rating: number; title: string | null; body: string | null; author_name: string | null; is_verified_purchase: boolean; is_approved: boolean; created_at: string; product: { name: string; slug: string } | null };
  const rows = (data ?? []) as R[];
  return (
    <AdminPage title="Reviews" subtitle="Hide inappropriate reviews; product ratings update automatically.">
      <Card>
        <Table head={["Product", "Rating", "Review", "Author", "Date", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className={r.is_approved ? "" : "opacity-60"}>
              <Td>{r.product ? <Link href={`/product/${r.product.slug}`} className="hover:text-primary">{r.product.name}</Link> : "—"}</Td>
              <Td className="whitespace-nowrap text-amber-600 font-semibold">{"★".repeat(r.rating)}</Td>
              <Td className="max-w-md">
                {r.title ? <p className="font-semibold">{r.title}</p> : null}
                <p className="text-secondary line-clamp-3">{r.body}</p>
              </Td>
              <Td>
                {r.author_name ?? "—"}
                {r.is_verified_purchase ? <p className="font-label-sm text-label-sm text-primary">Verified buyer</p> : null}
              </Td>
              <Td className="text-secondary whitespace-nowrap">{formatDate(r.created_at)}</Td>
              <Td>
                <ReviewActions id={r.id} approved={r.is_approved} />
              </Td>
            </tr>
          ))}
        </Table>
        {!rows.length ? <p className="font-body-md text-body-md text-secondary py-6 text-center">No reviews yet.</p> : null}
      </Card>
    </AdminPage>
  );
}
