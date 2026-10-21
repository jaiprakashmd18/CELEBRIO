import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

/**
 * Content Security Policy. Scripts are limited to this origin; images and API
 * calls may additionally reach the project's Supabase origin. Payment pages
 * are hosted by the provider (redirect), so no third-party scripts are needed.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://rzp.io https://razorpay.com",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js"],
  // Fonts and sample images are read from disk by the export engine.
  outputFileTracingIncludes: {
    "/api/exports": ["./public/fonts/**/*", "./public/templates/samples/**/*"],
    "/api/exports/[id]": ["./public/fonts/**/*", "./public/templates/samples/**/*"],
    "/api/preview/[projectId]": ["./public/fonts/**/*", "./public/templates/samples/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseOrigin ? [{ protocol: "https", hostname: new URL(supabaseOrigin).hostname, pathname: "/storage/v1/object/public/**" }] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/(dashboard|admin|checkout|editor|preview)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
