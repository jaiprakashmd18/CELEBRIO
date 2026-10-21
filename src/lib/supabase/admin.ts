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
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set on the server.");
  }
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
