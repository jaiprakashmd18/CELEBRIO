import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Deletes the signed-in user's account and personal data:
 * storage objects first, then the auth user (which cascades to profile,
 * projects, assets, entitlements and export jobs). Orders are retained with
 * user_id set to null for legally required financial records.
 */
export async function DELETE(request: Request) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const body = z.object({ confirm: z.literal("DELETE") }).safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "confirmation_required", "Please type DELETE to confirm.");
  if (!(await checkRateLimit("accountDelete", guard.user.id))) return jsonError(429, "rate_limited", "Please wait before trying again.");

  const admin = createSupabaseAdminClient();
  const userId = guard.user.id;
  for (const bucket of ["project-assets", "exports"] as const) {
    // Removed files disappear from the listing, so always read the first page again.
    for (let round = 0; round < 1000; round++) {
      const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 100 });
      if (!files?.length) break;
      await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      if (files.length < 100) break;
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return jsonError(500, "delete_failed", "We couldn't delete your account. Please contact support.");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
