import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { expireStaleOrders } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Orders" };

const STATUSES = ["pending", "paid", "failed", "expired", "cancelled", "refunded", "disputed"];

/** Search by safe identifiers only: order id, provider checkout id or payment reference. */
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("orders").select("id, status, amount_minor, currency, provider, provider_checkout_id, created_at, package, templates(name)").order("created_at", { ascending: false }).limit(100);
  const q = (sp.q ?? "").trim();
  if (q) {
    if (/^[0-9a-f-]{36}$/i.test(q)) query = query.eq("id", q);
    else if (/^[A-Za-z0-9_-]{4,200}$/.test(q)) query = query.or(`provider_checkout_id.eq.${q},provider_payment_reference.eq.${q}`);
  }
  if (sp.status && STATUSES.includes(sp.status)) query = query.eq("status", sp.status);
  const { data: orders } = await query;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl">Orders</h1>
        <form action={expireStaleOrders}><Button type="submit" size="sm" variant="secondary">Expire abandoned checkouts (&gt;2h)</Button></form>
      </div>
      <form className="flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">Order id or provider reference</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Order id, checkout id or payment reference" className="max-w-md" />
        <label className="sr-only" htmlFor="status">Status</label>
        <Select id="status" name="status" defaultValue={sp.status ?? ""} className="w-44"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Button type="submit" size="sm">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-gray"><tr><th className="p-3">Order</th><th className="p-3">Template</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Created</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(orders ?? []).map((o) => {
              const t = Array.isArray(o.templates) ? o.templates[0] : o.templates;
              return (
                <tr key={o.id}>
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs underline">{o.id.slice(0, 8)}…</Link></td>
                  <td className="p-3">{(t as { name?: string } | null)?.name}<span className="block text-xs text-gray">{o.package}</span></td>
                  <td className="p-3">{formatMoney(o.amount_minor, o.currency)}</td>
                  <td className="p-3"><Badge tone={o.status === "paid" ? "success" : o.status === "pending" ? "gold" : "neutral"}>{o.status}</Badge></td>
                  <td className="p-3">{o.provider}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
            {!orders?.length && <tr><td colSpan={6} className="p-6 text-center text-gray">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
