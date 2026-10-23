import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { checkOrderWithProvider } from "@/app/admin/actions";
import { RefundForm } from "@/components/admin/small-forms";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Order" };

const CHECK_MESSAGES: Record<string, string> = {
  paid: "The provider confirmed the payment. The order is now paid and the customer has access.",
  unchanged: "The provider reports no completed payment for this order.",
  unsupported: "This provider doesn't support status checks (or the order has no checkout).",
  error: "The provider couldn't be reached or returned an error. Check the API keys in Vercel and the server logs.",
};

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ check?: string }> }) {
  const { check } = await searchParams;
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data: o }, { data: events }, { data: entitlements }] = await Promise.all([
    supabase.from("orders").select("*, templates(name, slug)").eq("id", id).maybeSingle(),
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
    supabase.from("entitlements").select("id, status, allowed_formats, created_at, revoked_at").eq("order_id", id),
  ]);
  if (!o) notFound();
  const t = Array.isArray(o.templates) ? o.templates[0] : o.templates;
  const rows: Array<[string, React.ReactNode]> = [
    ["Order id", <code key="id" className="text-xs">{o.id}</code>],
    ["Status", <Badge key="s" tone={o.status === "paid" ? "success" : "neutral"}>{o.status}</Badge>],
    ["Amount", formatMoney(o.amount_minor, o.currency)],
    ["Package", `${o.package} · ${(o.entitlement_snapshot?.formats ?? []).join(", ")}`],
    ["Template", t ? <Link key="t" className="underline" href={`/templates/${t.slug}`}>{t.name}</Link> : "—"],
    ["Customer", o.user_id ? <code key="u" className="text-xs">{o.user_id}</code> : "Account deleted"],
    ["Provider", o.provider],
    ["Checkout id", <code key="c" className="text-xs">{o.provider_checkout_id ?? "—"}</code>],
    ["Payment reference", <code key="p" className="text-xs">{o.provider_payment_reference ?? "—"}</code>],
    ["Created", new Date(o.created_at).toLocaleString("en-IN")],
    ["Paid", o.paid_at ? new Date(o.paid_at).toLocaleString("en-IN") : "—"],
    ["Refunded", o.refunded_at ? new Date(o.refunded_at).toLocaleString("en-IN") : "—"],
    ["Failure reason", o.failure_reason ?? "—"],
  ];
  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm underline">← Orders</Link>
      <h1 className="font-serif text-4xl">Order details</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-6">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-gray">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <h2 className="mt-8 font-medium">Status history</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {(events ?? []).map((e) => <li key={e.id}>{new Date(e.created_at).toLocaleString("en-IN")} — {e.from_status ?? "∅"} → <strong>{e.to_status}</strong> ({e.source}){e.note ? ` · ${e.note}` : ""}</li>)}
          </ol>
          <h2 className="mt-8 font-medium">Entitlements</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(entitlements ?? []).map((e) => <li key={e.id}>{e.status} · {(e.allowed_formats as string[]).join(", ")}{e.revoked_at ? ` · revoked ${new Date(e.revoked_at).toLocaleString("en-IN")}` : ""}</li>)}
            {!entitlements?.length && <li className="text-gray">None</li>}
          </ul>
        </Card>
        <Card className="space-y-3 p-6">
          {o.status === "pending" && (
            <div className="space-y-2 border-b border-line pb-4">
              <h2 className="font-medium">Customer paid but not unlocked?</h2>
              <p className="text-sm text-gray">Ask the payment provider directly whether this checkout was paid. If it was, the order is unlocked exactly as a webhook would.</p>
              <form action={checkOrderWithProvider}><input type="hidden" name="id" value={o.id} /><Button type="submit" size="sm">Check payment with provider</Button></form>
            </div>
          )}
          {check && <p role="status" className="rounded-xl bg-sand p-3 text-sm">{CHECK_MESSAGES[check] ?? check}</p>}
          <h2 className="font-medium">Refunds & disputes</h2>
          <p className="text-sm text-gray">Issue the refund in your payment provider&apos;s dashboard first (the provider&apos;s refund webhook also updates this automatically). Recording it here revokes download access.</p>
          {o.status === "paid" || o.status === "disputed" ? <RefundForm orderId={o.id} /> : <p className="text-sm">No action available for a {o.status} order.</p>}
        </Card>
      </div>
    </div>
  );
}
