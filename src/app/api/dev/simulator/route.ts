import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/config/env";
import { isSameOrigin } from "@/lib/security/request";
import { SIMULATOR_SIGNATURE_HEADER, signSimulatorPayload } from "@/lib/payments/simulator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * DEVELOPMENT ONLY: plays the role of the payment provider's servers by
 * sending a signed webhook to /api/webhooks/simulator. Disabled unless
 * PAYMENT_PROVIDER=simulator and NODE_ENV is not production.
 */
const bodySchema = z.object({ checkoutId: z.string().regex(/^sim_[a-f0-9]{32}$/), outcome: z.enum(["pay", "decline", "expire", "refund"]) });

export async function POST(request: Request) {
  const env = serverEnv();
  if (env.NODE_ENV === "production" || env.PAYMENT_PROVIDER !== "simulator" || !env.SIMULATOR_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  if (!isSameOrigin(request)) return NextResponse.json({ error: "cross_site" }, { status: 403 });
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // The simulated provider knows what it charged: read it from the order it created.
  const { data: order } = await createSupabaseAdminClient()
    .from("orders")
    .select("amount_minor, currency, provider_payment_reference")
    .eq("provider", "simulator")
    .eq("provider_checkout_id", body.data.checkoutId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "unknown_checkout" }, { status: 404 });

  const type = ({ pay: "payment.succeeded", decline: "payment.failed", expire: "checkout.expired", refund: "payment.refunded" } as const)[body.data.outcome];
  const { body: payload, signature } = signSimulatorPayload(env.SIMULATOR_WEBHOOK_SECRET, {
    id: `simevt_${randomUUID()}`,
    type,
    checkoutId: body.data.checkoutId,
    paymentReference: order.provider_payment_reference ?? `simpay_${body.data.checkoutId.slice(4, 20)}`,
    amountMinor: order.amount_minor,
    currency: order.currency,
  });
  const res = await fetch(new URL("/api/webhooks/simulator", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", [SIMULATOR_SIGNATURE_HEADER]: signature },
    body: payload,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
