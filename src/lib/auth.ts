import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Returns the verified user for this request, or null.
 * Uses getUser(), which validates the session with Supabase Auth, so the
 * identity can never be forged by the browser.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, emailVerified: Boolean(data.user.email_confirmed_at) };
}

export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Admin status is read from the admin_users table through RLS, never from the client. */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!(await isAdmin(user.id))) redirect("/dashboard?notice=admin-only");
  return user;
}
