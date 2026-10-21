import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { CheckoutError, startCheckout } from "@/lib/orders/checkout";
import { PACKAGE_IDS } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";

// Only identifiers are accepted. Any "amount" or "price" field is ignored by design.
const bodySchema = z.object({ projectId: z.string().uuid(), package: z.enum(PACKAGE_IDS) });

export async function POST(request: Request) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  if (!guard.user.emailVerified) return jsonError(403, "email_unverified", "Please verify your email address before purchasing.");
  if (!(await checkRateLimit("checkout", guard.user.id))) return jsonError(429, "rate_limited", "Too many checkout attempts. Please wait a few minutes.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_input", "Invalid checkout request.");
  try {
    const result = await startCheckout(guard.user, body.data.projectId, body.data.package);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof CheckoutError) return jsonError(err.status, err.code, err.message);
    console.error("Checkout failed", err);
    return jsonError(500, "checkout_failed", "Checkout couldn't be started. You have not been charged.");
  }
}
