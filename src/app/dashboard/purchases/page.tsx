import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/money";
import { reconcilePendingOrder } from "@/lib/orders/reconcile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Purchase history" };

const TONE: Record<string, "success" | "neutral" | "rose" | "gold"> = { paid: "success", pending: "gold", refunded: "rose", disputed: "rose" };
const LABEL: Record<string, string> = { paid: "Paid", pending: "Awaiting confirmation", failed: "Failed", expired: "Expired", cancelled: "Cancelled", refunded: "Refunded", disputed: "Disputed" };

export default async function PurchasesPage() {
  await requireUser("/dashboard/purchases");
  const supabase = await createSupabaseServerClient();
  // Confirm recent pending payments with the provider in case a webhook was missed.
  const { data: pending } = await supabase.from("orders").select("id").eq("status", "pending").order("created_at", { ascending: false }).limit(3);
  if (pending?.length) {
    const admin = createSupabaseAdminClient();
    await Promise.all(pending.map((o) => reconcilePendingOrder(admin, o.id)));
  }
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, amount_minor, currency, package, created_at, paid_at, project_id, entitlement_snapshot, templates(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div>
      <h1 className="font-serif text-4xl">Purchase history</h1>
      <p className="mt-2 text-gray">Include the order reference when you contact support.</p>
      {!orders?.length ? (
        <div className="mt-8"><EmptyState icon={<Receipt className="size-6" />} title="No purchases yet" /></div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] bg-white ring-1 ring-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-gray">
              <tr><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Invitation</th><th className="p-4 font-medium">Amount</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Reference</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const t = Array.isArray(o.templates) ? o.templates[0] : o.templates;
                const snapshot = o.entitlement_snapshot as { projectTitle?: string; formats?: string[] };
                return (
                  <tr key={o.id}>
                    <td className="p-4 whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="p-4">
                      {o.project_id ? <Link className="underline" href={`/editor/${o.project_id}`}>{snapshot.projectTitle ?? (t as { name?: string } | null)?.name}</Link> : <span>{snapshot.projectTitle ?? "Deleted invitation"}</span>}
                      <span className="block text-xs text-gray">{o.package === "multi_format" ? "Multi-format" : "Single format"} · {snapshot.formats?.join(", ")}</span>
                    </td>
                    <td className="p-4 whitespace-nowrap">{o.amount_minor === 0 ? "Free" : formatMoney(o.amount_minor, o.currency)}</td>
                    <td className="p-4"><Badge tone={TONE[o.status] ?? "neutral"}>{LABEL[o.status] ?? o.status}</Badge></td>
                    <td className="p-4"><code className="text-xs">{o.id}</code></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
