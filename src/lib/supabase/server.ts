import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, serverEnv } from "@/config/env";

/**
 * Supabase client bound to the current user's session cookies.
 * Every query made with it is subject to Row Level Security.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  const env = serverEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session cookie on the next request.
        }
      },
    },
  });
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README).");
    this.name = "SupabaseNotConfiguredError";
  }
}
