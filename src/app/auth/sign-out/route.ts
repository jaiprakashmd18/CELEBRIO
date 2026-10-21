import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/config/env";
import { forbiddenCrossSite, isSameOrigin } from "@/lib/security/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Sign out is a POST (from a form) so it can't be triggered by a cross-site link. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossSite();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
