import "server-only";
import Stripe from "stripe";
import { PaymentConfigError, WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from "./types";

/**
 * Stripe Checkout adapter. Before launch, confirm that Stripe supports your
 * business's country, entity type and the currency you charge in (for India,
 * Stripe accounts are invite-only — see README "Choosing a payment provider").
 */
export function createStripeProvider(opts: { secretKey?: string; webhookSecret?: string }): PaymentProvider {
  let client: Stripe | null = null;
  const stripe = () => {
    if (!opts.secretKey) throw new PaymentConfigError("STRIPE_SECRET_KEY is not set");
    client ??= new Stripe(opts.secretKey, { maxNetworkRetries: 2, appInfo: { name: "Celebrio" } });
    return client;
  };

  return {
    id: "stripe",
    supportsCurrency: (currency) => /^[A-Z]{3}$/.test(currency),

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const expiresAt = new Date(Date.now() + 31 * 60 * 1000); // Stripe minimum is 30 minutes
      const session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountMinor,
                product_data: { name: input.productName, description: input.description },
              },
            },
          ],
          customer_email: input.customerEmail ?? undefined,
          client_reference_id: input.orderId,
          metadata: { order_id: input.orderId },
          payment_intent_data: { metadata: { order_id: input.orderId } },
          success_url: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(expiresAt.getTime() / 1000),
        },
        { idempotencyKey: `celebrio-checkout-${input.orderId}` },
      );
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { providerCheckoutId: session.id, url: session.url, expiresAt };
    },

    async fetchCheckoutStatus(checkoutId: string) {
      if (!opts.secretKey || !/^cs_[A-Za-z0-9_]+$/.test(checkoutId)) return null;
      const s = await stripe().checkout.sessions.retrieve(checkoutId);
      if (s.payment_status === "paid") {
        return {
          status: "paid" as const,
          paymentReference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
          amountMinor: s.amount_total ?? -1,
          currency: (s.currency ?? "").toUpperCase(),
        };
      }
      if (s.status === "expired") return { status: "expired" as const };
      return { status: "pending" as const };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!opts.webhookSecret) throw new PaymentConfigError("STRIPE_WEBHOOK_SECRET is not set");
      const signature = headers.get("stripe-signature");
      if (!signature) throw new WebhookSignatureError("Missing Stripe-Signature header");
      let event: Stripe.Event;
      try {
        event = await stripe().webhooks.constructEventAsync(rawBody, signature, opts.webhookSecret);
      } catch {
        throw new WebhookSignatureError();
      }
      const base = { eventId: event.id, type: event.type };
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const s = event.data.object;
          if (s.payment_status !== "paid") return { kind: "ignored", ...base };
          return {
            kind: "paid",
            ...base,
            checkoutId: s.id,
            paymentReference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
            amountMinor: s.amount_total ?? -1,
            currency: (s.currency ?? "").toUpperCase(),
          };
        }
        case "checkout.session.async_payment_failed":
          return { kind: "failed", ...base, checkoutId: event.data.object.id, reason: "Payment failed" };
        case "checkout.session.expired":
          return { kind: "expired", ...base, checkoutId: event.data.object.id, reason: "Checkout session expired" };
        case "charge.refunded": {
          const charge = event.data.object;
          if (!charge.refunded) return { kind: "ignored", ...base }; // partial refunds are handled manually
          const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
          return pi ? { kind: "refunded", ...base, paymentReference: pi, checkoutId: null } : { kind: "ignored", ...base };
        }
        case "charge.dispute.created": {
          const dispute = event.data.object;
          const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
          return pi ? { kind: "disputed", ...base, paymentReference: pi, checkoutId: null } : { kind: "ignored", ...base };
        }
        default:
          return { kind: "ignored", ...base };
      }
    },
  };
}
