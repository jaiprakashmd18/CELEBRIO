/**
 * Payment adapter contract. Business logic (orders, entitlements) never talks
 * to a provider SDK directly, so another provider can be added by writing one
 * adapter that implements this interface.
 */
export type ProviderId = "stripe" | "razorpay" | "simulator";

export interface CreateCheckoutInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  productName: string;
  description: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  providerCheckoutId: string;
  url: string;
  expiresAt: Date;
}

export type WebhookEvent =
  | { kind: "paid"; eventId: string; type: string; checkoutId: string; paymentReference: string | null; amountMinor: number; currency: string }
  | { kind: "failed" | "expired" | "cancelled"; eventId: string; type: string; checkoutId: string; reason: string }
  | { kind: "refunded" | "disputed"; eventId: string; type: string; paymentReference: string; checkoutId: string | null }
  | { kind: "ignored"; eventId: string; type: string };

export interface PaymentProvider {
  id: ProviderId;
  /** Currencies this adapter can charge. Nothing is converted automatically. */
  supportsCurrency(currency: string): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Verifies the signature and normalises the event. Throws WebhookSignatureError when invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}
