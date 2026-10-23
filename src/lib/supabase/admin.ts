import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/config/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. It BYPASSES Row Level Security, so it is only used by
 * server code after the caller's identity and permissions have been verified
 * (uploads, exports, checkout, webhooks, rate limiting). Never import this
 * from a client component.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (client) return client;
  const env = serverEnv();
  const missing = [
    !env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      `Missing on the server: ${missing.join(", ")} (deployment environment: ${env.VERCEL_ENV ?? env.NODE_ENV}).`,
    );
  }
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
