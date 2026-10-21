import "server-only";
import { serverEnv } from "@/config/env";
import { createRazorpayProvider } from "./razorpay";
import { createSimulatorProvider } from "./simulator";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider, ProviderId } from "./types";

export function getPaymentProviderById(id: ProviderId): PaymentProvider {
  const env = serverEnv();
  switch (id) {
    case "stripe":
      return createStripeProvider({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET });
    case "razorpay":
      return createRazorpayProvider({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET });
    case "simulator":
      if (env.NODE_ENV === "production") throw new Error("The payment simulator is disabled in production");
      return createSimulatorProvider({ webhookSecret: env.SIMULATOR_WEBHOOK_SECRET, siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") });
  }
}

/** The provider used for new checkouts (PAYMENT_PROVIDER). */
export function getActivePaymentProvider(): PaymentProvider {
  return getPaymentProviderById(serverEnv().PAYMENT_PROVIDER);
}

export * from "./types";
