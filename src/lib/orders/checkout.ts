import "server-only";
import { serverEnv } from "@/config/env";
import type { SessionUser } from "@/lib/auth";
import { getActivePaymentProvider } from "@/lib/payments";
import { PACKAGE_LABELS, PricingError, calculateQuote, type PackageId } from "@/lib/pricing";
import { missingRequiredFields } from "@/lib/projects/validate";
import { projectDataSchema, FORMAT_IDS, type FormatId } from "@/lib/templates/schema";
import { loadTemplateVersion } from "@/lib/data/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type CheckoutResult = { kind: "redirect"; url: string; orderId: string } | { kind: "already_owned"; url: string };

/**
 * Creates (or reuses) a pending order and a hosted checkout session.
 * The price is calculated here from the database — never from the request.
 */
export async function startCheckout(user: SessionUser, projectId: string, pkg: PackageId): Promise<CheckoutResult> {
  const env = serverEnv();
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // 1. Ownership is enforced by RLS on the user's own client.
  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, template_id, template_version, project_data, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.owner_id !== user.id) throw new CheckoutError(404, "not_found", "Invitation not found.");

  // 2. Trusted template and price data.
  const { data: template } = await admin
    .from("templates")
    .select("id, name, price_amount, multi_format_price_amount, currency, is_free, supported_formats, is_archived")
    .eq("id", project.template_id)
    .single();
  if (!template || template.is_archived) throw new CheckoutError(410, "template_unavailable", "This design is no longer available for purchase.");
  const definition = await loadTemplateVersion(admin, project.template_id, project.template_version);
  const parsed = projectDataSchema.safeParse(project.project_data);
  if (!definition || !parsed.success) throw new CheckoutError(422, "invalid_project", "This invitation couldn't be loaded.");
  const missing = missingRequiredFields(definition, parsed.data);
  if (missing.length) throw new CheckoutError(422, "incomplete", `Please fill in: ${missing.join(", ")}.`);

  let quote;
  try {
    quote = calculateQuote(
      {
        priceAmount: template.price_amount,
        multiFormatPriceAmount: template.multi_format_price_amount,
        currency: template.currency,
        isFree: template.is_free,
        supportedFormats: FORMAT_IDS.filter((f) => (template.supported_formats as string[]).includes(f)),
      },
      pkg,
      parsed.data.format as FormatId,
    );
  } catch (err) {
    if (err instanceof PricingError) throw new CheckoutError(400, err.code, err.message);
    throw err;
  }

  // 3. Already owned? Don't charge twice.
  const { data: owned } = await admin
    .from("entitlements")
    .select("allowed_formats, orders!inner(status)")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("orders.status", "paid");
  const ownedFormats = new Set((owned ?? []).flatMap((e) => e.allowed_formats as string[]));
  if (quote.formats.every((f) => ownedFormats.has(f))) return { kind: "already_owned", url: "/dashboard/invitations" };

  const snapshot = {
    package: quote.package,
    formats: quote.formats,
    fileTypes: quote.fileTypes,
    templateVersion: project.template_version,
    projectTitle: project.title,
  };

  // 4. Free designs: grant through the same audited database function.
  if (quote.isFree) {
    const { data: order, error } = await admin
      .from("orders")
      .insert({ user_id: user.id, project_id: projectId, template_id: template.id, package: quote.package, amount_minor: 0, currency: quote.currency, provider: "free", entitlement_snapshot: snapshot })
      .select("id")
      .single();
    if (error || !order) throw new CheckoutError(500, "order_failed", "We couldn't unlock this invitation. Please try again.");
    await admin.from("orders").update({ provider_checkout_id: `free_${order.id}` }).eq("id", order.id);
    const { error: rpcError } = await admin.rpc("mark_order_paid", {
      p_provider: "free",
      p_checkout_id: `free_${order.id}`,
      p_payment_reference: null,
      p_amount_minor: 0,
      p_currency: quote.currency,
      p_event_id: null,
    });
    if (rpcError) throw new CheckoutError(500, "order_failed", "We couldn't unlock this invitation. Please try again.");
    return { kind: "redirect", url: `/checkout/success?order=${order.id}`, orderId: order.id };
  }

  const provider = getActivePaymentProvider();
  if (!provider.supportsCurrency(quote.currency)) {
    throw new CheckoutError(400, "currency_unsupported", `Payments in ${quote.currency} aren't available with the configured payment provider.`);
  }

  // 5. Reuse an open checkout for the same invitation and package (avoids double payment).
  const { data: openOrder } = await admin
    .from("orders")
    .select("id, checkout_url, checkout_expires_at, amount_minor")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("package", quote.package)
    .eq("status", "pending")
    .eq("provider", provider.id)
    .gt("checkout_expires_at", new Date(Date.now() + 5 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openOrder?.checkout_url && openOrder.amount_minor === quote.amountMinor) {
    return { kind: "redirect", url: openOrder.checkout_url, orderId: openOrder.id };
  }

  // 6. Pending order first, then the provider session.
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      project_id: projectId,
      template_id: template.id,
      package: quote.package,
      amount_minor: quote.amountMinor,
      currency: quote.currency,
      provider: provider.id,
      entitlement_snapshot: snapshot,
    })
    .select("id")
    .single();
  if (error || !order) throw new CheckoutError(500, "order_failed", "We couldn't start checkout. Please try again.");

  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      productName: `${template.name} invitation`,
      description: `${PACKAGE_LABELS[quote.package].title}: ${quote.formats.join(", ")} — PNG, JPEG & PDF`,
      customerEmail: user.email,
      successUrl: `${site}/checkout/success?order=${order.id}`,
      cancelUrl: `${site}/checkout/cancelled?order=${order.id}`,
    });
    await admin
      .from("orders")
      .update({ provider_checkout_id: session.providerCheckoutId, checkout_url: session.url, checkout_expires_at: session.expiresAt.toISOString() })
      .eq("id", order.id);
    await admin.from("order_events").insert({ order_id: order.id, from_status: null, to_status: "pending", source: "checkout", actor_id: user.id });
    return { kind: "redirect", url: session.url, orderId: order.id };
  } catch (err) {
    await admin.from("orders").update({ status: "failed", failure_reason: "checkout_creation_failed" }).eq("id", order.id);
    console.error("Checkout creation failed", err instanceof Error ? err.message : err);
    throw new CheckoutError(502, "provider_error", "The payment provider couldn't start checkout. You have not been charged. Please try again.");
  }
}
