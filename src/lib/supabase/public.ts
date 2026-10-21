import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/config/env";

let client: SupabaseClient | null = null;

/**
 * Cookie-less anonymous client for public catalogue data (published templates
 * and categories). Because it never carries a user session, responses built
 * from it can be cached without any risk of leaking private data.
 */
export function createSupabasePublicClient(): SupabaseClient {
  if (client) return client;
  const env = serverEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
