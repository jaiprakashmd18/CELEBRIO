# Troubleshooting

**"Supabase is not configured" / sign-in page shows a warning**
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. Check `.env.local` (locally) or Vercel environment variables, then restart `npm run dev` / redeploy. `NEXT_PUBLIC_*` values are baked in at build time, so a redeploy is required after changing them.

**Verification or reset emails never arrive**
Supabase's default email sender is rate limited. Configure custom SMTP (Authentication → Emails). Check that `https://<domain>/auth/confirm` is listed under Redirect URLs. Locally with `supabase start`, emails appear in Mailpit at <http://127.0.0.1:54324>.

**Clicking the email link says "That link is invalid or has expired"**
Links are single-use and short-lived, and must be opened in the same browser for PKCE links. Request a new link.

**Paid, but the confirmation page keeps "Confirming your payment…"**
The webhook isn't reaching the site or is being rejected.
- Stripe: Dashboard → Developers → Webhooks → your endpoint → recent deliveries. A `400 invalid_signature` means `STRIPE_WEBHOOK_SECRET` doesn't match that endpoint (each endpoint and `stripe listen` session has its own secret).
- Razorpay: Settings → Webhooks → delivery logs; check `RAZORPAY_WEBHOOK_SECRET`.
- Vercel → Project → Logs, filter by `/api/webhooks`.
Once fixed, resend the event from the provider dashboard — processing is idempotent.

**Order marked `failed` with reason `amount_mismatch`**
The provider reported a different amount or currency than the order. Usually a price edited mid-checkout or a provider-side currency setting. Investigate in Admin → Orders; refund if the customer was charged.

**"Payments in XXX aren't available with the configured payment provider"**
The template's currency isn't supported by the adapter (Razorpay is INR only). Change the template currency or provider.

**Downloads fail with `render_timeout` or `busy`**
Very large photos or a burst of exports. Ask the customer to retry; consider increasing the Vercel function memory/duration for `/api/exports`. Failures are listed in Admin → Exports.

**Fonts look different in exports**
Fonts must exist in `public/fonts` and be traced into the serverless bundle (`outputFileTracingIncludes` in `next.config.ts`). Run `npm run test:unit` — the export tests render every template.

**Gallery doesn't show a new template**
It must be **Published**, not archived, and have a preview image. Public pages are cached for up to 5 minutes; publishing triggers revalidation.

**`npm run test:integration` is skipped**
Set `DATABASE_URL_TEST` to a disposable PostgreSQL server (the tests create and drop their own database).

**Playwright can't find a browser**
Run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium binary.

**"Upload failed" for a photo**
Only JPEG, PNG and WebP up to 8 MB and at least 200 px per side are accepted. HEIC photos from iPhones must be exported as JPEG first (or set the camera to "Most Compatible").

**Editor says "Edited in another tab"**
The project was saved elsewhere. Choose *Load the latest version* or *Keep my version*; nothing is merged silently.
