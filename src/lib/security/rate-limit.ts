import "server-only";
import { isSupabaseConfigured, serverEnv } from "@/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limiting backed by Postgres (public.check_rate_limit), so
 * limits hold across serverless instances. In local development without
 * Supabase an in-memory limiter is used instead.
 */
const memory = new Map<string, { windowStart: number; count: number }>();

export const LIMITS = {
  upload: { windowSeconds: 3600, max: 60 },
  export: { windowSeconds: 3600, max: 30 },
  checkout: { windowSeconds: 3600, max: 20 },
  contact: { windowSeconds: 3600, max: 5 },
  projectWrite: { windowSeconds: 60, max: 90 },
  preview: { windowSeconds: 3600, max: 120 },
  accountDelete: { windowSeconds: 3600, max: 3 },
} as const;

export type LimitName = keyof typeof LIMITS;

export async function checkRateLimit(name: LimitName, subject: string): Promise<boolean> {
  const limit = name === "export" ? { ...LIMITS.export, max: serverEnv().EXPORTS_PER_HOUR } : LIMITS[name];
  const key = `${name}:${subject}`;
  if (!isSupabaseConfigured() || !serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
    const now = Date.now();
    const windowStart = Math.floor(now / (limit.windowSeconds * 1000));
    const entry = memory.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      memory.set(key, { windowStart, count: 1 });
      return true;
    }
    entry.count++;
    return entry.count <= limit.max;
  }
  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    console.error("Rate limit check failed", error.message);
    return true; // Fail open so an outage of the limiter does not block customers.
  }
  return data === true;
}
