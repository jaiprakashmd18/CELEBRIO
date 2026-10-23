import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaymentProviderById, type ProviderId } from "@/lib/payments";

export type ReconcileOutcome = "paid" | "unchanged" | "unsupported" | "error";

/**
 * Backup for webhooks: asks the payment provider (server to server, using the
 * secret API key) whether a pending order's checkout was paid, and if so runs
 * the same atomic, idempotent database function a webhook would. The
 * browser's word is never trusted — only the provider's API response.
 */
export async function reconcilePendingOrder(admin: SupabaseClient, orderId: string): Promise<ReconcileOutcome> {
  const { data: order } = await admin.from("orders").select("id, status, provider, provider_checkout_id").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "pending" || !order.provider_checkout_id) return "unchanged";
  if (order.provider !== "stripe" && order.provider !== "razorpay") return "unsupported";

  let status;
  try {
    status = await getPaymentProviderById(order.provider as ProviderId).fetchCheckoutStatus?.(order.provider_checkout_id);
  } catch (err) {
    console.error("Payment status check failed", order.id, err instanceof Error ? err.message : err);
    return "error";
  }
  if (!status) return "unsupported";
  if (status.status === "paid") {
    const { error } = await admin.rpc("mark_order_paid", {
      p_provider: order.provider,
      p_checkout_id: order.provider_checkout_id,
      p_payment_reference: status.paymentReference,
      p_amount_minor: status.amountMinor,
      p_currency: status.currency,
      p_event_id: null,
    });
    if (error) {
      console.error("mark_order_paid during reconcile failed", order.id, error.message);
      return "error";
    }
    return "paid";
  }
  if (status.status === "expired" || status.status === "cancelled") {
    await admin.rpc("mark_order_unsuccessful", {
      p_provider: order.provider,
      p_checkout_id: order.provider_checkout_id,
      p_status: status.status,
      p_reason: "Reported by provider status check",
      p_event_id: null,
    });
  }
  return "unchanged";
}
