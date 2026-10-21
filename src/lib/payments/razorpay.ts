import "server-only";
import { hmacSha256Hex, signaturesMatch } from "./hmac";
import { PaymentConfigError, WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from "./types";

/**
 * Razorpay adapter using hosted Payment Links (a regional alternative for
 * Indian businesses). Webhooks are verified with HMAC-SHA256 of the raw body
 * using the webhook secret configured in the Razorpay dashboard.
 */
export function createRazorpayProvider(opts: { keyId?: string; keySecret?: string; webhookSecret?: string; fetchImpl?: typeof fetch }): PaymentProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    id: "razorpay",
    supportsCurrency: (currency) => currency === "INR",

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      if (!opts.keyId || !opts.keySecret) throw new PaymentConfigError("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // Razorpay minimum is 15 minutes
      const res = await doFetch("https://api.razorpay.com/v1/payment_links", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          accept_partial: false,
          description: `${input.productName} — ${input.description}`.slice(0, 2048),
          reference_id: input.orderId.slice(0, 40),
          customer: input.customerEmail ? { email: input.customerEmail } : undefined,
          notify: { email: false, sms: false },
          callback_url: input.successUrl,
          callback_method: "get",
          expire_by: Math.floor(expiresAt.getTime() / 1000),
          notes: { order_id: input.orderId },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; short_url?: string; error?: { description?: string } };
      if (!res.ok || !body.id || !body.short_url) throw new Error(`Razorpay error: ${body.error?.description ?? res.status}`);
      return { providerCheckoutId: body.id, url: body.short_url, expiresAt };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!opts.webhookSecret) throw new PaymentConfigError("RAZORPAY_WEBHOOK_SECRET is not set");
      const signature = headers.get("x-razorpay-signature") ?? "";
      if (!signaturesMatch(hmacSha256Hex(opts.webhookSecret, rawBody), signature)) throw new WebhookSignatureError();
      const payload = JSON.parse(rawBody) as {
        event: string;
        payload: {
          payment_link?: { entity: { id: string; amount_paid?: number; currency?: string; status?: string } };
          payment?: { entity: { id: string; amount?: number; currency?: string } };
          refund?: { entity: { payment_id: string; amount: number } };
        };
      };
      const eventId = headers.get("x-razorpay-event-id") ?? `rzp-${hmacSha256Hex("event-id", rawBody).slice(0, 32)}`;
      const base = { eventId, type: payload.event };
      const link = payload.payload.payment_link?.entity;
      const payment = payload.payload.payment?.entity;
      switch (payload.event) {
        case "payment_link.paid":
          if (!link) return { kind: "ignored", ...base };
          return { kind: "paid", ...base, checkoutId: link.id, paymentReference: payment?.id ?? null, amountMinor: link.amount_paid ?? payment?.amount ?? -1, currency: (link.currency ?? payment?.currency ?? "").toUpperCase() };
        case "payment_link.expired":
          return link ? { kind: "expired", ...base, checkoutId: link.id, reason: "Payment link expired" } : { kind: "ignored", ...base };
        case "payment_link.cancelled":
          return link ? { kind: "cancelled", ...base, checkoutId: link.id, reason: "Payment link cancelled" } : { kind: "ignored", ...base };
        case "refund.processed": {
          const refund = payload.payload.refund?.entity;
          return refund ? { kind: "refunded", ...base, paymentReference: refund.payment_id, checkoutId: null } : { kind: "ignored", ...base };
        }
        case "payment.dispute.created":
          return payment ? { kind: "disputed", ...base, paymentReference: payment.id, checkoutId: null } : { kind: "ignored", ...base };
        default:
          return { kind: "ignored", ...base };
      }
    },
  };
}
