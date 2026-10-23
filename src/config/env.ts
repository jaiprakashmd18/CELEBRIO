import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Secrets are read only here and only on the
 * server — none of these values are ever sent to the browser.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  PAYMENT_PROVIDER: z.enum(["stripe", "razorpay", "simulator"]).default("stripe"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  RAZORPAY_KEY_ID: z.string().startsWith("rzp_").optional(),
  RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
  SIMULATOR_WEBHOOK_SECRET: z.string().min(16).optional(),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(100_000).max(10_000_000).default(8_000_000),
  UPLOAD_MAX_PIXELS: z.coerce.number().int().min(1_000_000).max(80_000_000).default(40_000_000),
  EXPORTS_PER_HOUR: z.coerce.number().int().min(1).max(500).default(30),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** CI / local demos only: serve the built-in starter catalogue when Supabase is not configured. */
  CELEBRIO_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  /** Set by Vercel: "production", "preview" or "development". */
  VERCEL_ENV: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${problems}. See .env.example.`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.PAYMENT_PROVIDER === "simulator") {
    throw new Error("PAYMENT_PROVIDER=simulator is for local development only and cannot be used in production.");
  }
  cached = parsed.data;
  return cached;
}

/** True when Supabase credentials are configured. */
/**
 * The built-in starter catalogue may be used instead of the database only
 * when Supabase isn't configured AND this isn't the live site: local
 * development, CI (CELEBRIO_DEMO_MODE) or a Vercel preview deployment
 * without database keys. The live site always requires Supabase.
 */
export function demoCatalogAllowed(): boolean {
  const env = serverEnv();
  return env.NODE_ENV !== "production" || env.CELEBRIO_DEMO_MODE === "true" || env.VERCEL_ENV === "preview";
}

export function isSupabaseConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
