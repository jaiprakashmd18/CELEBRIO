import "server-only";
import { randomUUID } from "node:crypto";
import { hmacSha256Hex, signaturesMatch } from "./hmac";
import { PaymentConfigError, WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from "./types";

/**
 * LOCAL DEVELOPMENT ONLY. Mimics a hosted checkout page and sends HMAC-signed
 * webhooks through the same verification and order-processing code as real
 * providers, so the full purchase flow can be tested without network access.
 * serverEnv() refuses to start with PAYMENT_PROVIDER=simulator in production.
 */
export const SIMULATOR_SIGNATURE_HEADER = "x-celebrio-simulator-signature";

export interface SimulatorPayload {
  id: string;
  type: "payment.succeeded" | "payment.failed" | "checkout.expired" | "payment.refunded";
  checkoutId: string;
  paymentReference?: string;
  amountMinor?: number;
  currency?: string;
}

export function signSimulatorPayload(secret: string, payload: SimulatorPayload): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  return { body, signature: hmacSha256Hex(secret, body) };
}

export function createSimulatorProvider(opts: { webhookSecret?: string; siteUrl: string }): PaymentProvider {
  return {
    id: "simulator",
    supportsCurrency: (currency) => /^[A-Z]{3}$/.test(currency),
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      if (!opts.webhookSecret) throw new PaymentConfigError("SIMULATOR_WEBHOOK_SECRET is not set");
      const id = `sim_${randomUUID().replace(/-/g, "")}`;
      const params = new URLSearchParams({ checkout: id, order: input.orderId, amount: String(input.amountMinor), currency: input.currency, success: input.successUrl, cancel: input.cancelUrl });
      return { providerCheckoutId: id, url: `${opts.siteUrl}/checkout/simulator?${params}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    },
    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!opts.webhookSecret) throw new PaymentConfigError("SIMULATOR_WEBHOOK_SECRET is not set");
      const signature = headers.get(SIMULATOR_SIGNATURE_HEADER) ?? "";
      if (!signaturesMatch(hmacSha256Hex(opts.webhookSecret, rawBody), signature)) throw new WebhookSignatureError();
      const p = JSON.parse(rawBody) as SimulatorPayload;
      const base = { eventId: p.id, type: p.type };
      switch (p.type) {
        case "payment.succeeded":
          return { kind: "paid", ...base, checkoutId: p.checkoutId, paymentReference: p.paymentReference ?? null, amountMinor: p.amountMinor ?? -1, currency: p.currency ?? "" };
        case "payment.failed":
          return { kind: "failed", ...base, checkoutId: p.checkoutId, reason: "Simulated card decline" };
        case "checkout.expired":
          return { kind: "expired", ...base, checkoutId: p.checkoutId, reason: "Simulated expiry" };
        case "payment.refunded":
          return p.paymentReference ? { kind: "refunded", ...base, paymentReference: p.paymentReference, checkoutId: p.checkoutId } : { kind: "ignored", ...base };
        default:
          return { kind: "ignored", ...base };
      }
    },
  };
}
