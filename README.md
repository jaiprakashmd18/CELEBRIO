# Celebrio — Make Every Moment Beautiful.

Celebrio is a digital invitation platform. Customers browse original templates, personalise them with their own words and photos (in a simple form-based editor or an advanced drag-and-drop editor), preview them for free with a watermark, pay once per invitation, and download high-resolution PNG, JPEG and print-ready PDF files.

This README is written for a beginner. Follow the steps in order; each one explains **what** you are doing and **why**.

> **Honest status.** The code, database migrations, security policies, payment integration and tests are complete and have been run in a development environment (see [What has been verified](#what-has-been-verified)). Nothing is deployed, no Supabase project or payment account has been created for you, and live payments are **not** enabled. Steps 5–20 below are things *you* must do with your own accounts.

---

## Contents

- [How Celebrio works](#how-celebrio-works)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Step-by-step setup](#step-by-step-setup) (steps 1–14)
- [Deploying to production](#deploying-to-production) (steps 15–20)
- [Choosing a payment provider](#choosing-a-payment-provider)
- [Bootstrapping the first administrator](#bootstrapping-the-first-administrator)
- [Testing](#testing)
- [What has been verified](#what-has-been-verified)
- [Everyday tasks](#everyday-tasks)
- More docs: [docs/TEMPLATES.md](docs/TEMPLATES.md) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) · [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)

---

## How Celebrio works

```
Browser                                   Server (Next.js on Vercel)                 Supabase / payment provider
───────                                   ──────────────────────────                 ───────────────────────────
Gallery & template pages  ───────────────▶ cached public catalogue  ───────────────▶ templates table (RLS: published only)
Editor (simple + advanced)
  └─ same renderer as exports
  └─ autosave ───────────────────────────▶ /api/projects (validates every save) ───▶ projects table (RLS: owner only)
  └─ photo upload ───────────────────────▶ /api/uploads (checks + re-encodes) ────▶ private "project-assets" bucket
Checkout button ─────────────────────────▶ /api/checkout (price from database) ───▶ pending order + hosted checkout page
                                           /api/webhooks/<provider>  ◀─────────────  signed webhook "payment succeeded"
                                             └─ verify signature, mark paid,
                                                grant ONE entitlement (atomic SQL)
Download button ─────────────────────────▶ /api/exports
                                             └─ check paid entitlement
                                             └─ render PNG/JPEG/PDF (resvg)  ────────▶ private "exports" bucket
                                             └─ 5-minute signed download link
```

Key ideas:

1. **One template engine.** Templates are versioned JSON (`TemplateDefinition`). A single renderer turns a template + a customer's project into SVG. The browser shows that SVG live; the server rasterises the *same* SVG with the *same* font files for exports. What you see is what you download.
2. **One project format.** Both editors read and write the same `ProjectData` JSON, so switching modes never loses work.
3. **The server decides.** Prices come from the database, payment is confirmed only by signed webhooks, and every clean download checks a paid entitlement on the server. Watermarks in the browser are a courtesy, not the protection.

## Technology

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4 with brand tokens in `src/app/globals.css`, Lucide icons |
| Forms | React Hook Form + Zod |
| Data & auth | Supabase Auth, PostgreSQL with Row Level Security, Supabase Storage |
| Payments | Adapter with Stripe Checkout and Razorpay Payment Links, plus a local simulator |
| Rendering | Custom SVG template engine; exports via `@resvg/resvg-js`, `sharp`, `pdf-lib` |
| Tests | Vitest (unit + database integration), Playwright (end-to-end) |
| Hosting | Vercel + Supabase + GitHub |

**Documented deviations from the brief:**

- *Advanced editor library.* Instead of a canvas library such as Konva, the advanced editor manipulates the same SVG the export engine renders (pointer events for drag/resize, keyboard nudging, layers, undo/redo). A separate canvas renderer would draw text and images differently from the export, breaking "what you see is what you download".
- *PDF output.* PDFs embed a 300 DPI render on a page with the design's exact proportions (e.g. 6 × 10.67 in for portrait) rather than vector text, so they look identical to the PNG. Print shops can print at that size or scale proportionally.

All package versions are pinned exactly in `package.json`.

## Project structure

```
src/
  app/
    (marketing)/          Home, gallery, category pages, template detail, pricing, FAQ, legal pages
    (auth)/               Sign in / up, check email, forgot & reset password
    auth/                 Email-link confirmation and sign-out route handlers
    editor/               New invitation (guests allowed) and saved-project editor
    checkout/             Checkout summary, confirmation, cancelled, dev simulator
    dashboard/            Customer account: drafts, purchases, downloads, settings
    admin/                Admin dashboard (templates, categories, orders, exports, support, audit)
    api/                  projects, uploads, assets, checkout, webhooks, exports, preview, orders, contact, account
  components/             UI (layout, editor, templates, forms, payments, admin, shared, ui)
  features/editor/        Editor state store, autosave, guest drafts, photo handling
  lib/
    rendering/            Template engine: fonts, text layout, decor artwork, renderer
    templates/            Schemas (Zod), categories, sample images
    projects/             Pure edit operations + server-side validation
    exports/              Rasteriser and export authorisation helpers
    payments/             Provider adapters (Stripe, Razorpay, simulator)
    orders/               Checkout and webhook processing
    security/             Rate limiting, same-origin checks, upload validation, safe redirects
    supabase/             Server, browser, public and service-role clients
  templates/starter/      The 16 original starter templates (code → seed.sql)
supabase/
  migrations/             Schema, RLS policies, payment functions, storage buckets
  seed.sql                Generated: categories + 16 templates (safe to re-run)
  config.toml             Local Supabase CLI configuration
public/
  fonts/                  OFL font files used by both the browser and the export engine (+ licences)
  templates/samples/      Original illustrated sample photos (generated)
  templates/previews/     Template preview images (generated)
  brand/og.png            Social sharing image (generated)
scripts/                  Generators: font metrics, samples, previews, seed, brand assets, validation
tests/                    unit/, integration/ (real PostgreSQL), e2e/ (Playwright)
docs/                     Template authoring, security, troubleshooting, launch checklist
```

---

## Step-by-step setup

### 1. Install Node.js and Git

- **Node.js 22 LTS** (20.9 or newer works): download from <https://nodejs.org>. Check with `node -v`.
- **Git**: <https://git-scm.com/downloads>. Check with `git --version`.

### 2. Get the project

If you're starting from this repository:

```bash
git clone https://github.com/<your-account>/<your-repo>.git celebrio
cd celebrio
```

### 3. Install dependencies

```bash
npm ci
```

`npm ci` installs the exact versions recorded in `package-lock.json`. At this point you can already run `npm run dev` and explore the gallery and editor — without Supabase, the 16 starter templates are served from code and drafts are kept in your browser.

### 4. Set up a GitHub repository

1. Create an empty repository on GitHub (no README).
2. Connect and push:
   ```bash
   git remote add origin https://github.com/<your-account>/<your-repo>.git
   git push -u origin main
   ```
The included CI workflow (`.github/workflows/ci.yml`) runs lint, type checks, all tests and a production build on every push.

### 5. Create a Supabase project

1. Sign up at <https://supabase.com> and click **New project**. Choose a region close to your customers (e.g. Mumbai for India).
2. Save the database password somewhere safe.
3. Open **Project Settings → API** and note the **Project URL**, the **anon/publishable key** and the **service_role/secret key**. The service role key is a master key — never put it in browser code, screenshots or Git.

### 6. Apply the database migrations

Migrations create every table, index, security policy, database function and storage bucket. Use the Supabase CLI (installed with `npx`, no global install needed):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>     # the ref is in your project URL
npx supabase db push                                    # applies supabase/migrations/*.sql in order
```

*Alternative without the CLI:* open **SQL Editor** in the dashboard and run each file in `supabase/migrations/` in filename order.

### 7. Insert the 16 starter templates

```bash
npx supabase db push --include-seed
```

or paste the contents of `supabase/seed.sql` into the SQL Editor and run it. The seed is **safe to run again**: it never creates duplicate categories or templates, and it never overwrites a template you've edited in the admin dashboard.

If you change a starter template in `src/templates/starter/`, regenerate the SQL with `npm run db:seed:generate` (and the preview images with `npm run templates:previews`).

### 8. Configure Supabase Authentication

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now (you'll change it at step 18).
- **Redirect URLs**: add `http://localhost:3000/auth/confirm` (and later `https://<your-domain>/auth/confirm`).

In **Authentication → Providers → Email**: keep **Confirm email** enabled. Set a minimum password length of 8.

In **Authentication → Emails (SMTP settings)**: Supabase's built-in email sender is heavily rate-limited and meant for testing. Before launch, connect your own SMTP provider (e.g. Resend, Postmark, Amazon SES).

The email links in Supabase's default templates already work with Celebrio (`/auth/confirm` handles both the `?code=` and `token_hash` formats).

### 9. Storage buckets and policies

Migration `20261021000004_storage.sql` creates them for you:

| Bucket | Public? | Purpose |
| --- | --- | --- |
| `template-previews` | yes | Gallery preview images (only admins can upload) |
| `project-assets` | no | Customer photos — accessed only through `/api/assets/<id>` after an ownership check |
| `exports` | no | Generated paid files — delivered through 5-minute signed URLs |

Check in **Storage** that the three buckets exist and that only `template-previews` is public.

### 10. Configure the payment provider in test mode

Read [Choosing a payment provider](#choosing-a-payment-provider) first. Then:

**Stripe**
1. Create an account at <https://dashboard.stripe.com>, stay in **Test mode**.
2. **Developers → API keys**: copy the *Secret key* (`sk_test_…`) into `STRIPE_SECRET_KEY`.
3. Set `PAYMENT_PROVIDER=stripe`.

**Razorpay**
1. Create an account at <https://dashboard.razorpay.com>, switch to **Test Mode**.
2. **Account & Settings → API Keys**: generate a key; set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Set `PAYMENT_PROVIDER=razorpay` (Razorpay adapter charges INR only).

**No account yet?** For local development only, use the built-in simulator: `PAYMENT_PROVIDER=simulator` and `SIMULATOR_WEBHOOK_SECRET=<any random 16+ characters>`. It imitates a hosted checkout and sends signed webhooks through the same code path. It refuses to run in production.

### 11. Set up verified webhooks

Webhooks are how the provider tells Celebrio "this payment succeeded". Without them, nobody gets their downloads.

**Stripe, locally** (with the Stripe CLI, <https://stripe.com/docs/stripe-cli>):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.dispute.created
```

Copy the printed `whsec_…` secret into `STRIPE_WEBHOOK_SECRET`.

**Razorpay**: webhooks need a public URL, so configure them after deployment (step 17). For local testing you can use a tunnel such as `ngrok http 3000`.

### 12. Create your local environment file

```bash
cp .env.example .env.local
```

Fill in the values from steps 5, 10 and 11. Every variable is explained in `.env.example`. `.env.local` is ignored by Git — keep it that way.

### 13. Start the development server

```bash
npm run dev
```

Open <http://localhost:3000>. Try the whole journey: sign up, verify your email, personalise a template, check out with test card `4242 4242 4242 4242` (any future date, any CVC) on Stripe, and download your files from **My account → Purchased & downloads**.

### 14. Run the checks and tests

```bash
npm run lint
npm run typecheck
npm run test:unit
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/postgres npm run test:integration
npm run build
npm run test:e2e
```

Fix any failure before deploying — see [Testing](#testing) for details and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common problems.

---

## Deploying to production

### 15. Deploy to Vercel

1. Sign in at <https://vercel.com> with GitHub and click **Add New → Project**.
2. Import your repository. Vercel detects Next.js automatically; keep the default build settings.
3. Don't deploy yet — add the environment variables first (step 16).

### 16. Configure production environment variables

In **Vercel → Project → Settings → Environment Variables**, add for **Production** (and Preview if you use it):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (server-only — never prefix with `NEXT_PUBLIC_`) |
| `PAYMENT_PROVIDER` | `stripe` or `razorpay` (**not** `simulator`) |
| Provider keys | **test** keys until the launch checklist is complete |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_LEGAL_ENTITY_NAME` | your details |

Do **not** set `CELEBRIO_DEMO_MODE` in production. Then click **Deploy**.

### 17. Configure the production webhook URL

- **Stripe** → Developers → Webhooks → *Add endpoint*: `https://<your-domain>/api/webhooks/stripe`, events as listed in step 11. Copy its signing secret into Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy.
- **Razorpay** → Settings → Webhooks → *Add new webhook*: `https://<your-domain>/api/webhooks/razorpay`, set a secret (also in Vercel as `RAZORPAY_WEBHOOK_SECRET`), events `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `refund.processed`, `payment.dispute.created`.

### 18. Domain and HTTPS

1. Vercel → Project → **Settings → Domains** → add your domain and follow the DNS instructions. Vercel issues HTTPS certificates automatically.
2. Update `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy.
3. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://<your-domain>` and add `https://<your-domain>/auth/confirm` to the redirect URLs.

### 19. Test a complete purchase and download in production (test mode)

On the live site, with test keys: sign up with a real inbox, verify, create an invitation, pay with a test card, confirm the order shows as **Paid** in **Admin → Orders**, and download PNG, JPEG and PDF. Also confirm a cancelled checkout leaves the order unpaid and that unpaid downloads are refused.

### 20. Switch to live payments — only after the launch checklist

Work through [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) (legal review, provider activation, tax, support inbox, backups…). Then replace the test keys and webhook secrets in Vercel with **live** ones, create the live webhook endpoint, redeploy, and make one small real purchase that you refund afterwards.

---

## Choosing a payment provider

Never assume eligibility — check before you build your launch plan:

- **Stripe** supports one-time Checkout payments in many countries. In India, Stripe accounts are currently invite-only and require specific business documentation; check <https://stripe.com/global> and contact Stripe sales. Confirm that your country, business type and charging currency (INR in the starter data) are supported.
- **Razorpay** is widely available for Indian businesses (requires KYC and an Indian bank account). The adapter uses hosted *Payment Links* and charges INR.
- **Other providers**: implement the `PaymentProvider` interface in `src/lib/payments/types.ts` (create a hosted checkout + verify and normalise webhooks), register it in `src/lib/payments/index.ts`, and add the name to the `orders.provider` check constraint with a new migration. No order or entitlement logic needs to change.

Prices are stored as **integer minor units with an explicit currency** (`4900` + `INR` = ₹49.00). Celebrio never converts currencies. Taxes (e.g. GST) and invoicing requirements depend on your jurisdiction — confirm them with an accountant; Stripe Tax or Razorpay invoices may help.

## Bootstrapping the first administrator

Admin access is stored in the `admin_users` table, which no customer can write to. To make yourself an admin:

1. Sign up on the site with the email you want to use and verify it.
2. In Supabase **SQL Editor**, run:
   ```sql
   insert into public.admin_users (user_id, note)
   select id, 'founder' from auth.users where email = 'you@example.com';
   ```
3. Sign out and in again, then open `/admin`.

To remove an admin: `delete from public.admin_users where user_id = '<uuid>';`. Sensitive admin actions (template edits, publishing, price changes, refunds) are written to **Admin → Audit log**.

## Testing

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm run test:unit` | Pricing, no implicit currency conversion, template validation (all 16), editable-field and project validation, text wrapping/overflow, aspect ratios and image cropping maths, entitlement rules, export-format permissions, edit operations, webhook signature verification (Stripe, Razorpay, simulator), upload signature checks, safe redirects, and real PNG/JPEG/PDF generation for every template and format | nothing |
| `npm run test:integration` | Migrations, idempotent seed, RLS (public vs. owner vs. other user vs. admin), customers unable to mark orders paid or grant entitlements, admin bootstrap protection, template versioning, atomic & idempotent payment functions, amount mismatch, out-of-order events, refunds, duplicate webhooks through the production webhook code, private storage, rate limiting, account deletion retention | `DATABASE_URL_TEST` → a throw-away PostgreSQL 15+ server (tests create and drop their own database) |
| `npm run test:e2e` | Guest browsing/filter/search, guest personalisation in both editor modes with reload recovery, watermarked preview, refusal of unauthenticated exports/checkout and forged webhooks, CSRF origin check, protected routes, 404 page, sitemap/robots/canonical, mobile overflow | Playwright Chromium (`npx playwright install chromium`) |
| `E2E_SUPABASE=1 npm run test:e2e` | Full journey: sign-up + email verification, save/reopen draft, upload/crop photo, preview, unpaid export refused, other user blocked, price manipulation ignored, simulator payment, webhook grants one entitlement even when replayed, PNG and PDF download, admin publishes a new template that then works in both editors | Local Supabase (`npx supabase start`), `.env.local` pointing at it, `PAYMENT_PROVIDER=simulator`, `SIMULATOR_WEBHOOK_SECRET` |

Never run tests against a real customer database or live payment keys.

## What has been verified

In the development container used to build this project (Node 22, PostgreSQL 16, Chromium):

- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- `npm run test:unit`: **98 tests pass**, including real PNG/JPEG/PDF exports of all 16 templates in every supported format.
- `npm run test:integration` against PostgreSQL 16 with the Supabase compatibility shim: **12 tests pass** (these caught and fixed a real ambiguity bug in `mark_order_paid`).
- `npm run test:e2e` guest suite: **7 tests pass** (desktop and mobile).
- **Not run here**: the `E2E_SUPABASE=1` full-purchase suite (no Docker/Supabase stack was available), real Stripe/Razorpay API calls, and Supabase-hosted email delivery. The supporting code paths are covered by unit and integration tests, but run that suite locally before launch.

## Everyday tasks

- **Add or edit a template** — Admin → Templates. See [docs/TEMPLATES.md](docs/TEMPLATES.md) for the JSON format.
- **Change prices** — Admin → Templates → *Details & pricing*. Amounts are in minor units. Changes are audited.
- **Refund an order** — refund in the provider's dashboard (the refund webhook revokes access automatically), or record it under Admin → Orders → order → *Refunds & disputes*.
- **Abandoned checkouts** — Admin → Orders → *Expire abandoned checkouts*.
- **Delete old generated files** — Admin → Exports → *Delete files older than 30 days* (files are regenerated on demand).
- **Rebrand** — edit the CSS variables at the top of `src/app/globals.css` and `src/config/site.ts`.
