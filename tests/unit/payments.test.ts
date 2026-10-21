import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@/lib/payments/hmac";
import { createRazorpayProvider } from "@/lib/payments/razorpay";
import { SIMULATOR_SIGNATURE_HEADER, createSimulatorProvider, signSimulatorPayload } from "@/lib/payments/simulator";
import { createStripeProvider } from "@/lib/payments/stripe";
import { WebhookSignatureError } from "@/lib/payments/types";

const STRIPE_SECRET = "whsec_test_secret_for_unit_tests";

function stripeEvent(type: string, object: Record<string, unknown>) {
  return JSON.stringify({ id: `evt_${type.replace(/\W/g, "")}`, object: "event", type, data: { object }, api_version: "2025-01-01", created: 1, livemode: false, pending_webhooks: 0, request: null });
}

describe("Stripe webhook verification", () => {
  const provider = createStripeProvider({ secretKey: "sk_test_dummy", webhookSecret: STRIPE_SECRET });
  const sign = (payload: string, secret = STRIPE_SECRET) => new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });

  it("accepts a correctly signed completed checkout and normalises it", async () => {
    const payload = stripeEvent("checkout.session.completed", { id: "cs_test_1", object: "checkout.session", payment_status: "paid", payment_intent: "pi_1", amount_total: 4900, currency: "inr" });
    const event = await provider.parseWebhook(payload, new Headers({ "stripe-signature": sign(payload) }));
    expect(event).toMatchObject({ kind: "paid", checkoutId: "cs_test_1", paymentReference: "pi_1", amountMinor: 4900, currency: "INR" });
  });

  it("rejects a tampered body or wrong secret", async () => {
    const payload = stripeEvent("checkout.session.completed", { id: "cs_test_1", payment_status: "paid", amount_total: 4900, currency: "inr" });
    const header = sign(payload);
    await expect(provider.parseWebhook(payload.replace("4900", "1"), new Headers({ "stripe-signature": header }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(provider.parseWebhook(payload, new Headers({ "stripe-signature": sign(payload, "whsec_other") }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(provider.parseWebhook(payload, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("does not treat an unpaid (async) completion as paid, and maps expiry and refunds", async () => {
    const unpaid = stripeEvent("checkout.session.completed", { id: "cs_2", payment_status: "unpaid", amount_total: 4900, currency: "inr" });
    expect((await provider.parseWebhook(unpaid, new Headers({ "stripe-signature": sign(unpaid) }))).kind).toBe("ignored");
    const expired = stripeEvent("checkout.session.expired", { id: "cs_3" });
    expect(await provider.parseWebhook(expired, new Headers({ "stripe-signature": sign(expired) }))).toMatchObject({ kind: "expired", checkoutId: "cs_3" });
    const refund = stripeEvent("charge.refunded", { id: "ch_1", refunded: true, payment_intent: "pi_9" });
    expect(await provider.parseWebhook(refund, new Headers({ "stripe-signature": sign(refund) }))).toMatchObject({ kind: "refunded", paymentReference: "pi_9" });
  });
});

describe("Razorpay webhook verification", () => {
  const secret = "rzp_webhook_secret";
  const provider = createRazorpayProvider({ webhookSecret: secret });
  const body = JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: { id: "plink_1", amount_paid: 9900, currency: "INR" } }, payment: { entity: { id: "pay_1" } } } });

  it("verifies the HMAC signature and maps payment_link.paid", async () => {
    const event = await provider.parseWebhook(body, new Headers({ "x-razorpay-signature": hmacSha256Hex(secret, body), "x-razorpay-event-id": "evt_1" }));
    expect(event).toMatchObject({ kind: "paid", eventId: "evt_1", checkoutId: "plink_1", paymentReference: "pay_1", amountMinor: 9900, currency: "INR" });
  });
  it("rejects bad signatures", async () => {
    await expect(provider.parseWebhook(body, new Headers({ "x-razorpay-signature": hmacSha256Hex("wrong", body) }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(provider.parseWebhook(body, new Headers({ "x-razorpay-signature": "zz" }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
  it("only supports INR (no implicit conversion)", () => {
    expect(provider.supportsCurrency("INR")).toBe(true);
    expect(provider.supportsCurrency("USD")).toBe(false);
  });
  it("creates hosted payment links with server-provided amounts", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const p = createRazorpayProvider({
      keyId: "rzp_test_x",
      keySecret: "secret123",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ id: "plink_9", short_url: "https://rzp.io/i/abc" }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const session = await p.createCheckout({ orderId: "order-1", amountMinor: 4900, currency: "INR", productName: "Test", description: "Single", customerEmail: null, successUrl: "https://x/s", cancelUrl: "https://x/c" });
    expect(session).toMatchObject({ providerCheckoutId: "plink_9", url: "https://rzp.io/i/abc" });
    expect(calls[0]?.body).toMatchObject({ amount: 4900, currency: "INR", reference_id: "order-1" });
  });
});

describe("development simulator", () => {
  it("uses the same signed-webhook path", async () => {
    const provider = createSimulatorProvider({ webhookSecret: "simulator-secret-123456", siteUrl: "http://localhost:3000" });
    const { body, signature } = signSimulatorPayload("simulator-secret-123456", { id: "e1", type: "payment.succeeded", checkoutId: "sim_x", amountMinor: 4900, currency: "INR" });
    expect(await provider.parseWebhook(body, new Headers({ [SIMULATOR_SIGNATURE_HEADER]: signature }))).toMatchObject({ kind: "paid", amountMinor: 4900 });
    await expect(provider.parseWebhook(body, new Headers({ [SIMULATOR_SIGNATURE_HEADER]: "00" }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
