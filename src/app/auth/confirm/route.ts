import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/config/env";
import { safeNextPath } from "@/lib/security/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Handles links from Supabase emails (verification, password recovery).
 * Supports both the token_hash format and the PKCE ?code= format.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const fail = NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  if (!isSupabaseConfigured()) return fail;
  const supabase = await createSupabaseServerClient();

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail : NextResponse.redirect(new URL(next, url.origin));
  }
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, url.origin));
  }
  return fail;
}
