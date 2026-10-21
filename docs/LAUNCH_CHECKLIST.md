# Production-readiness checklist

Tick every item before switching to live payment keys.

## Business and legal
- [ ] Payment provider account fully activated for **live** payments (KYC complete, payouts bank account verified) and confirmed to support your country, entity type and currency.
- [ ] Terms, privacy, refund, cookie and acceptable-use pages reviewed by a qualified professional for your jurisdiction; all `[placeholders]` replaced; "Last updated" dates set.
- [ ] Data protection obligations checked (e.g. India's DPDP Act 2023; GDPR/UK GDPR if you serve EU/UK customers); grievance/contact officer named if required.
- [ ] Tax registration and invoicing (e.g. GST) confirmed with an accountant; prices and receipts reflect it.
- [ ] Consumer-law requirements for digital goods and refunds confirmed.
- [ ] `NEXT_PUBLIC_LEGAL_ENTITY_NAME`, support email and business address published.

## Accounts and configuration
- [ ] Supabase project on a paid plan with backups/point-in-time recovery appropriate for your business.
- [ ] All migrations applied (`npx supabase db push`) and seed loaded; 16 templates visible.
- [ ] Custom SMTP configured for auth emails; email templates branded.
- [ ] Site URL and redirect URLs set to the production domain.
- [ ] First administrator bootstrapped; no test admins left in `admin_users`.
- [ ] Vercel production environment variables set; `PAYMENT_PROVIDER` is **not** `simulator`; `CELEBRIO_DEMO_MODE` not set.
- [ ] Custom domain with HTTPS; `NEXT_PUBLIC_SITE_URL` matches it.
- [ ] Live webhook endpoint created with the correct events; live webhook secret in Vercel.
- [ ] Storage buckets: only `template-previews` is public.

## Quality
- [ ] CI is green on the release commit (lint, typecheck, unit, integration, build, e2e).
- [ ] `E2E_SUPABASE=1` full-purchase suite passed against a local Supabase stack.
- [ ] Manual test-mode purchase on the production domain: pay, webhook, download PNG/JPEG/PDF, refund revokes access.
- [ ] Manual checks on a real phone (iOS Safari and Android Chrome): browse, personalise, upload a photo, checkout.
- [ ] Every template reviewed in every format with long names and empty optional fields.
- [ ] Lighthouse/axe pass on home, gallery, template detail and editor (no critical accessibility issues).

## Operations
- [ ] Support inbox monitored; Admin → Support checked daily.
- [ ] Refund and dispute process documented for whoever handles support.
- [ ] Scheduled reminder to run *Expire abandoned checkouts* and *Delete old exports* (or automate them with Supabase cron).
- [ ] Error monitoring/log alerts configured (e.g. Vercel log drains or Sentry) — remember to update the privacy policy if you add a vendor.
- [ ] One small live purchase made and refunded successfully.
