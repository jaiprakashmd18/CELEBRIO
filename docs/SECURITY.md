# Security, privacy and data handling

## Trust boundaries

| Concern | Where it is enforced |
| --- | --- |
| Who the user is | `supabase.auth.getUser()` on the server (`src/lib/auth.ts`). User ids sent by the browser are never trusted. |
| Who can read/write rows | PostgreSQL Row Level Security (`supabase/migrations/…02_security_policies.sql`) |
| Admin access | `admin_users` table + `is_admin()`; every admin page and server action calls `requireAdmin()` |
| Prices | `startCheckout()` reads prices from `templates`; request bodies only carry `projectId` and `package` |
| "Paid" | Only `mark_order_paid()` (service role, called from signature-verified webhooks) — never the success page |
| Clean downloads | `/api/exports` → `decideCleanExport()` checks owner + paid, non-revoked entitlement covering the format and file type |
| Uploads | Size, declared type, magic-byte signature, decode with sharp, pixel limit, re-encode (strips EXIF/GPS), private bucket |
| Customer text | Rendered only as escaped SVG `<text>`; the serialiser allows a fixed list of SVG tags and attribute names |
| CSRF | Same-origin check on every mutating API route, POST-only sign-out, SameSite=Lax cookies; Server Actions have Next.js's built-in origin check |
| Abuse | Postgres-backed rate limits (uploads, exports, checkout, contact, saves, account deletion) + per-instance render concurrency limit + 45 s render timeout |
| Headers | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (`next.config.ts`); private areas send `X-Robots-Tag: noindex` |

The service-role key is read only in `src/lib/supabase/admin.ts` (marked `server-only`). It is used for storage, orders, webhooks and rate limits **after** the caller has been authenticated and authorised.

## Verifying RLS yourself

The automated suite (`npm run test:integration`) checks these against a real database. To spot-check a hosted project, run in the SQL editor:

```sql
-- As an anonymous visitor: only published templates are visible.
begin; set local role anon; select count(*) from templates; rollback;

-- As a specific customer: only their own projects/orders are visible, writes to orders fail.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<customer-uuid>')::text, true);
select count(*) from projects;                      -- their projects only
update orders set status = 'paid';                  -- 0 rows
insert into entitlements (order_id, allowed_formats) values (gen_random_uuid(), '{portrait}');  -- RLS error
select * from mark_order_paid('stripe', 'x', 'y', 1, 'INR', null);                              -- permission denied
rollback;
```

## Data retention (edit to match your policy)

| Data | Kept until |
| --- | --- |
| Drafts, photos | The customer deletes the invitation or their account |
| Generated files (`exports` bucket) | 30 days (Admin → Exports → cleanup), regenerated on demand |
| Orders, order events | Required accounting period; `user_id` becomes `null` when the account is deleted |
| Support requests | Your chosen period; `user_id` becomes `null` on account deletion |
| Rate-limit counters | ~1 day (pruned automatically) |

Account deletion (`DELETE /api/account`) removes the customer's storage files, then the auth user, which cascades to profile, projects, assets, entitlements and export jobs.

## Analytics

Celebrio ships with no analytics or tracking cookies. If you add analytics, prefer a privacy-friendly tool, keep it off until the visitor enables it on `/cookies`, and update the privacy policy.

## Reporting a vulnerability

Publish a security contact (e.g. `security@<your-domain>`) before launch and add it to the privacy policy.
