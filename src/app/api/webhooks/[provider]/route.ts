import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import { processWebhookEvent } from "@/lib/orders/webhooks";
import { getPaymentProviderById, PaymentConfigError, WebhookSignatureError, type ProviderId } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/**
 * Payment provider webhooks. Configure the provider to call
 *   https://<your-domain>/api/webhooks/stripe   or   /api/webhooks/razorpay
 * The raw body is verified against the provider signature before anything
 * else happens. A browser reaching the success page never marks an order paid.
 */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const allowed: ProviderId[] = serverEnv().NODE_ENV === "production" ? ["stripe", "razorpay"] : ["stripe", "razorpay", "simulator"];
  if (!allowed.includes(provider as ProviderId)) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  let event;
  try {
    event = await getPaymentProviderById(provider as ProviderId).parseWebhook(rawBody, request.headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    if (err instanceof PaymentConfigError) {
      console.error(`Webhook for ${provider} rejected: ${err.message}`);
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    const outcome = await processWebhookEvent(createSupabaseAdminClient(), provider as ProviderId, event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error(`Webhook processing failed (${provider} ${event.eventId})`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
