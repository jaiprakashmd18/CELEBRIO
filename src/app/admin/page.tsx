import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { daysAgoIso } from "@/lib/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Overview" };

/** Basic business metrics computed from real database records. */
export default async function AdminOverview() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const since = daysAgoIso(30);
  const [{ data: orders }, { data: templates }, { count: failedExports }, { count: openSupport }, { count: customers }] = await Promise.all([
    supabase.from("orders").select("status, amount_minor, currency, created_at, provider").gte("created_at", since).limit(10000),
    supabase.from("templates").select("is_published, is_archived, use_count, name, id").order("use_count", { ascending: false }),
    supabase.from("export_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
    supabase.from("support_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  const paid = (orders ?? []).filter((o) => o.status === "paid");
  const revenue = new Map<string, number>();
  for (const o of paid) revenue.set(o.currency, (revenue.get(o.currency) ?? 0) + o.amount_minor);
  const byStatus = new Map<string, number>();
  for (const o of orders ?? []) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
  const published = (templates ?? []).filter((t) => t.is_published).length;
  const archived = (templates ?? []).filter((t) => t.is_archived).length;
  const stats = [
    { label: "Revenue (30 days)", value: revenue.size ? [...revenue.entries()].map(([c, a]) => formatMoney(a, c)).join(" + ") : formatMoney(0, "INR") },
    { label: "Paid orders (30 days)", value: String(paid.filter((o) => o.amount_minor > 0).length) },
    { label: "Free unlocks (30 days)", value: String(paid.filter((o) => o.amount_minor === 0).length) },
    { label: "Customers", value: String(customers ?? 0) },
    { label: "Published templates", value: `${published} of ${(templates ?? []).length}` },
    { label: "Failed exports (30 days)", value: String(failedExports ?? 0), href: "/admin/exports" },
    { label: "Open support requests", value: String(openSupport ?? 0), href: "/admin/support" },
    { label: "Archived templates", value: String(archived) },
  ];
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-gray">{s.label}</p>
            <p className="mt-2 font-serif text-3xl">{s.href ? <Link href={s.href} className="hover:underline">{s.value}</Link> : s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-medium">Orders by status (30 days)</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {[...byStatus.entries()].map(([s, n]) => <li key={s} className="flex justify-between"><span className="capitalize">{s}</span><span>{n}</span></li>)}
            {byStatus.size === 0 && <li className="text-gray">No orders yet.</li>}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-medium">Most used templates (all time)</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {(templates ?? []).slice(0, 8).map((t) => <li key={t.id} className="flex justify-between"><Link href={`/admin/templates/${t.id}`} className="hover:underline">{t.name}</Link><span>{t.use_count} drafts</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
