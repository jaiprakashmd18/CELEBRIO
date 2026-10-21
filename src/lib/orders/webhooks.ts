import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderId, WebhookEvent } from "@/lib/payments/types";

export type WebhookOutcome = "duplicate" | "processed" | "ignored" | "order_not_found";

/**
 * Applies a verified provider event. Idempotent:
 *   - each provider event id is recorded once (duplicates are skipped);
 *   - the database functions themselves are idempotent and lock the order row,
 *     so concurrent or out-of-order deliveries cannot grant twice.
 */
export async function processWebhookEvent(admin: SupabaseClient, provider: ProviderId, event: WebhookEvent): Promise<WebhookOutcome> {
  const { data: isNew, error: recordError } = await admin.rpc("record_webhook_event", { p_provider: provider, p_event_id: event.eventId, p_event_type: event.type });
  if (recordError) throw new Error(`record_webhook_event failed: ${recordError.message}`);
  if (isNew === false) return "duplicate";

  try {
    let outcome: WebhookOutcome = "processed";
    if (event.kind === "paid") {
      const { error } = await admin.rpc("mark_order_paid", {
        p_provider: provider,
        p_checkout_id: event.checkoutId,
        p_payment_reference: event.paymentReference,
        p_amount_minor: event.amountMinor,
        p_currency: event.currency,
        p_event_id: event.eventId,
      });
      if (error) {
        if (/order_not_found/.test(error.message)) outcome = "order_not_found";
        else throw new Error(error.message);
      }
    } else if (event.kind === "failed" || event.kind === "expired" || event.kind === "cancelled") {
      const { error } = await admin.rpc("mark_order_unsuccessful", {
        p_provider: provider,
        p_checkout_id: event.checkoutId,
        p_status: event.kind,
        p_reason: event.reason,
        p_event_id: event.eventId,
      });
      if (error) {
        if (/order_not_found/.test(error.message)) outcome = "order_not_found";
        else throw new Error(error.message);
      }
    } else if (event.kind === "refunded" || event.kind === "disputed") {
      const { data: order } = await admin
        .from("orders")
        .select("id")
        .eq("provider", provider)
        .eq("provider_payment_reference", event.paymentReference)
        .maybeSingle();
      if (!order) {
        outcome = "order_not_found";
      } else {
        const { error } = await admin.rpc("mark_order_refunded", {
          p_order_id: order.id,
          p_status: event.kind,
          p_source: "webhook",
          p_actor: null,
          p_event_id: event.eventId,
          p_note: event.type,
        });
        if (error) throw new Error(error.message);
      }
    } else {
      outcome = "ignored";
    }
    await admin.rpc("finish_webhook_event", { p_provider: provider, p_event_id: event.eventId, p_outcome: outcome });
    return outcome;
  } catch (err) {
    // Forget the event so the provider's retry is processed again.
    await admin.from("payment_webhook_events").delete().eq("provider", provider).eq("event_id", event.eventId);
    throw err;
  }
}
