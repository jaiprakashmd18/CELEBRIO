import "server-only";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { forbiddenCrossSite, isSameOrigin, jsonError } from "@/lib/security/request";

/** Common guard for authenticated JSON API routes. */
export async function guardApi(request: Request, opts: { mutating: boolean }): Promise<{ user: SessionUser } | { response: Response }> {
  if (opts.mutating && !isSameOrigin(request)) return { response: forbiddenCrossSite() };
  if (!isSupabaseConfigured()) {
    return { response: jsonError(503, "accounts_unavailable", "Saving and purchasing need Supabase to be configured (see README).") };
  }
  const user = await getSessionUser();
  if (!user) return { response: jsonError(401, "not_authenticated", "Please sign in to continue.") };
  return { user };
}
