import "server-only";
import { NextResponse } from "next/server";
import { serverEnv } from "@/config/env";

/**
 * CSRF defence for cookie-authenticated API routes: state-changing requests
 * must come from our own origin. (Server Actions get an equivalent built-in
 * check from Next.js; session cookies are also SameSite=Lax.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POSTs; a missing header
    // means a same-origin navigation or a non-browser client.
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite === null || fetchSite === "same-origin" || fetchSite === "none";
  }
  const allowed = new Set([new URL(serverEnv().NEXT_PUBLIC_SITE_URL).origin, new URL(request.url).origin]);
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) allowed.add(`${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`);
  return allowed.has(origin);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function forbiddenCrossSite() {
  return jsonError(403, "cross_site_request", "This request must come from the Celebrio website.");
}
