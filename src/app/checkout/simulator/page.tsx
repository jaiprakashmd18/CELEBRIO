import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimulatorActions } from "@/components/payments/simulator-actions";
import { Alert, Container } from "@/components/ui/primitives";
import { serverEnv } from "@/config/env";
import { formatMoney } from "@/lib/money";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Test payment simulator" };

/** DEVELOPMENT ONLY stand-in for a provider's hosted checkout page. */
export default async function SimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const env = serverEnv();
  if (env.NODE_ENV === "production" || env.PAYMENT_PROVIDER !== "simulator") notFound();
  if (!sp.checkout || !/^sim_[a-f0-9]{32}$/.test(sp.checkout)) notFound();
  const amount = Number(sp.amount ?? 0);
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const local = (u?: string) => safeNextPath(u?.startsWith(site) ? u.slice(site.length) : u, "/dashboard");
  return (
    <Container className="max-w-md py-16">
      <Alert tone="info" title="Development payment simulator">No real money moves. This page imitates a provider&apos;s hosted checkout and sends a signed webhook, exactly like a real provider would.</Alert>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-line">
        <p className="text-sm text-gray">Amount due</p>
        <p className="font-serif text-4xl">{Number.isInteger(amount) ? formatMoney(amount, sp.currency ?? "INR") : "—"}</p>
        <SimulatorActions checkoutId={sp.checkout} successUrl={local(sp.success)} cancelUrl={local(sp.cancel)} />
      </div>
    </Container>
  );
}
