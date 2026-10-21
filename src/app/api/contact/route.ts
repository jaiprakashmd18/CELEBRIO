import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/config/env";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { clientIp, forbiddenCrossSite, isSameOrigin, jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation/contact";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossSite();
  if (!(await checkRateLimit("contact", clientIp(request)))) {
    return jsonError(429, "rate_limited", "You've sent several messages recently. Please wait a little and try again.");
  }
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "invalid_input", "Please check the highlighted fields.", { issues: parsed.error.flatten().fieldErrors });
  if (parsed.data.website) return NextResponse.json({ ok: true }); // honeypot filled: silently ignore
  if (!isSupabaseConfigured()) {
    return jsonError(503, "not_configured", `Messages can't be stored yet. Please email ${siteConfig.supportEmail}.`);
  }
  const user = await getSessionUser();
  const { error } = await createSupabaseAdminClient().from("support_requests").insert({
    user_id: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    order_reference: parsed.data.orderReference || null,
  });
  if (error) return jsonError(500, "store_failed", `We couldn't save your message. Please email ${siteConfig.supportEmail}.`);
  return NextResponse.json({ ok: true });
}
