import { Client } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processWebhookEvent } from "@/lib/orders/webhooks";
import { DATABASE_URL, asRole, createTestDatabase } from "./support/db";
import { pgSupabase } from "./support/pg-supabase";
import fs from "node:fs";
import path from "node:path";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

describe.skipIf(!DATABASE_URL)("database: migrations, RLS and payment functions", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let client: Client;
  let templateId: string;
  let projectA: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    client = new Client({ connectionString: db.url });
    await client.connect();
    await client.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@example.com', '{"display_name":"Asha"}'), ($2, 'b@example.com', '{}'), ($3, 'admin@example.com', '{}')`, [USER_A, USER_B, ADMIN]);
    await client.query("insert into public.admin_users (user_id) values ($1)", [ADMIN]);
    const t = await client.query("select id, template_definition from public.templates where slug = 'peach-confetti'");
    templateId = t.rows[0].id;
    const p = await client.query(
      "insert into public.projects (owner_id, template_id, template_version, title, project_data) values ($1, $2, 1, 'A party', '{\"schemaVersion\":1}') returning id",
      [USER_A, templateId],
    );
    projectA = p.rows[0].id;
  });

  afterAll(async () => {
    await client?.end();
    await db?.drop();
  });

  async function newOrder(amount = 4900, provider = "stripe") {
    const checkout = `cs_${Math.random().toString(36).slice(2)}`;
    const r = await client.query(
      `insert into public.orders (user_id, project_id, template_id, package, amount_minor, currency, provider, provider_checkout_id, entitlement_snapshot)
       values ($1, $2, $3, 'single_format', $4, 'INR', $5, $6, '{"formats":["portrait"]}') returning id`,
      [USER_A, projectA, templateId, amount, provider, checkout],
    );
    return { id: r.rows[0].id as string, checkout };
  }

  it("applies migrations and the seed is safe to re-run", async () => {
    const seed = fs.readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    await client.query(seed);
    await client.query(seed);
    const counts = await client.query("select (select count(*) from public.templates)::int as t, (select count(*) from public.categories)::int as c, (select count(*) from public.template_versions)::int as v");
    expect(counts.rows[0]).toEqual({ t: 16, c: 8, v: 16 });
    const profile = await client.query("select display_name from public.profiles where id = $1", [USER_A]);
    expect(profile.rows[0].display_name).toBe("Asha");
  });

  it("public visitors only see published templates", async () => {
    await client.query("update public.templates set is_published = false where slug = 'neon-night'");
    const visible = await asRole(client, "anon", null, async () => (await client.query("select slug from public.templates")).rows.map((r) => r.slug));
    expect(visible).toHaveLength(15);
    expect(visible).not.toContain("neon-night");
    const asAdmin = await asRole(client, "authenticated", ADMIN, async () => (await client.query("select count(*)::int as n from public.templates")).rows[0].n);
    expect(asAdmin).toBe(16);
    await client.query("update public.templates set is_published = true where slug = 'neon-night'");
  });

  it("users can only read and change their own projects", async () => {
    const seenByB = await asRole(client, "authenticated", USER_B, async () => (await client.query("select id from public.projects where id = $1", [projectA])).rowCount);
    expect(seenByB).toBe(0);
    const updatedByB = await asRole(client, "authenticated", USER_B, async () => (await client.query("update public.projects set title = 'hacked' where id = $1", [projectA])).rowCount);
    expect(updatedByB).toBe(0);
    await expect(
      asRole(client, "authenticated", USER_B, () => client.query("insert into public.projects (owner_id, template_id, template_version, project_data) values ($1, $2, 1, '{}')", [USER_A, templateId])),
    ).rejects.toThrow(/row-level security/);
    const own = await asRole(client, "authenticated", USER_A, async () => (await client.query("update public.projects set title = 'Renamed' where id = $1", [projectA])).rowCount);
    expect(own).toBe(1);
  });

  it("customers cannot mark projects purchased, grant entitlements, create or pay orders", async () => {
    await expect(asRole(client, "authenticated", USER_A, () => client.query("update public.projects set status = 'purchased' where id = $1", [projectA]))).rejects.toThrow(/permission denied/);
    await expect(asRole(client, "authenticated", USER_A, () => client.query("update public.projects set owner_id = $2 where id = $1", [projectA, USER_B]))).rejects.toThrow(/permission denied/);
    const order = await newOrder();
    await expect(
      asRole(client, "authenticated", USER_A, () =>
        client.query(`insert into public.orders (user_id, package, amount_minor, currency, provider, entitlement_snapshot) values ($1, 'single_format', 0, 'INR', 'free', '{}')`, [USER_A]),
      ),
    ).rejects.toThrow(/row-level security/);
    const changed = await asRole(client, "authenticated", USER_A, async () => (await client.query("update public.orders set status = 'paid' where id = $1", [order.id])).rowCount);
    expect(changed).toBe(0);
    await expect(asRole(client, "authenticated", USER_A, () => client.query("insert into public.entitlements (user_id, order_id, project_id, allowed_formats) values ($1, $2, $3, '{portrait}')", [USER_A, order.id, projectA]))).rejects.toThrow(/row-level security/);
    await expect(asRole(client, "authenticated", USER_A, () => client.query("select * from public.mark_order_paid('stripe', $1, 'pi', 4900, 'INR', null)", [order.checkout]))).rejects.toThrow(/permission denied/);
    // The owner can read their own order but not someone else's.
    expect(await asRole(client, "authenticated", USER_A, async () => (await client.query("select id from public.orders where id = $1", [order.id])).rowCount)).toBe(1);
    expect(await asRole(client, "authenticated", USER_B, async () => (await client.query("select id from public.orders where id = $1", [order.id])).rowCount)).toBe(0);
  });

  it("customers cannot make themselves administrators", async () => {
    await expect(asRole(client, "authenticated", USER_A, () => client.query("insert into public.admin_users (user_id) values ($1)", [USER_A]))).rejects.toThrow(/row-level security/);
    expect(await asRole(client, "authenticated", USER_A, async () => (await client.query("select public.is_admin() as a")).rows[0].a)).toBe(false);
    expect(await asRole(client, "authenticated", ADMIN, async () => (await client.query("select public.is_admin() as a")).rows[0].a)).toBe(true);
    const nonAdminUpdate = await asRole(client, "authenticated", USER_A, async () => (await client.query("update public.templates set price_amount = 1 where id = $1", [templateId])).rowCount);
    expect(nonAdminUpdate).toBe(0);
  });

  it("only admins can save a new template version, atomically", async () => {
    const def = (await client.query("select template_definition from public.templates where id = $1", [templateId])).rows[0].template_definition;
    await expect(asRole(client, "authenticated", USER_A, () => client.query("select public.admin_save_template_definition($1, $2, '{portrait}', '9:16')", [templateId, def]))).rejects.toThrow(/not_authorized/);
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ADMIN })]);
    const v = await client.query("select public.admin_save_template_definition($1, $2, '{portrait,square,landscape}', '9:16') as v", [templateId, def]);
    await client.query("commit");
    expect(v.rows[0].v).toBe(2);
    const versions = await client.query("select version from public.template_versions where template_id = $1 order by version", [templateId]);
    expect(versions.rows.map((r) => r.version)).toEqual([1, 2]);
    const logged = await client.query("select count(*)::int as n from public.admin_audit_logs where action = 'template.definition_saved'");
    expect(logged.rows[0].n).toBe(1);
  });

  it("marks orders paid idempotently with exactly one entitlement", async () => {
    const order = await newOrder();
    const first = await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_1', 4900, 'INR', 'evt_1')", [order.checkout]);
    const second = await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_1', 4900, 'INR', 'evt_1')", [order.checkout]);
    expect(first.rows[0]).toMatchObject({ status: "paid", changed: true });
    expect(second.rows[0]).toMatchObject({ status: "paid", changed: false });
    const ents = await client.query("select allowed_formats from public.entitlements where order_id = $1", [order.id]);
    expect(ents.rowCount).toBe(1);
    expect(ents.rows[0].allowed_formats).toEqual(["portrait"]);
    expect((await client.query("select status from public.projects where id = $1", [projectA])).rows[0].status).toBe("purchased");
  });

  it("fails an order whose paid amount does not match (client cannot change the price)", async () => {
    const order = await newOrder(9900);
    const r = await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_2', 100, 'INR', 'evt_2')", [order.checkout]);
    expect(r.rows[0].status).toBe("failed");
    expect((await client.query("select count(*)::int as n from public.entitlements where order_id = $1", [order.id])).rows[0].n).toBe(0);
    const currency = await newOrder(9900);
    expect((await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_3', 9900, 'USD', null)", [currency.checkout])).rows[0].status).toBe("failed");
  });

  it("handles out-of-order events and refunds", async () => {
    const order = await newOrder();
    await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_4', 4900, 'INR', null)", [order.checkout]);
    const lateExpiry = await client.query("select * from public.mark_order_unsuccessful('stripe', $1, 'expired', 'late', null)", [order.checkout]);
    expect(lateExpiry.rows[0]).toMatchObject({ status: "paid", changed: false });
    const refund = await client.query("select * from public.mark_order_refunded($1, 'refunded', 'webhook', null, 'evt_r', null)", [order.id]);
    expect(refund.rows[0]).toMatchObject({ status: "refunded", changed: true });
    expect((await client.query("select status from public.entitlements where order_id = $1", [order.id])).rows[0].status).toBe("revoked");
    const repay = await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_4', 4900, 'INR', null)", [order.checkout]);
    expect(repay.rows[0]).toMatchObject({ status: "refunded", changed: false });

    const expiredFirst = await newOrder();
    await client.query("select * from public.mark_order_unsuccessful('stripe', $1, 'expired', 'abandoned', null)", [expiredFirst.checkout]);
    const latePaid = await client.query("select * from public.mark_order_paid('stripe', $1, 'pi_5', 4900, 'INR', null)", [expiredFirst.checkout]);
    expect(latePaid.rows[0]).toMatchObject({ status: "paid", changed: true });
  });

  it("processes duplicate webhooks once through the production webhook code", async () => {
    const order = await newOrder();
    const supabase = pgSupabase(client) as unknown as SupabaseClient;
    const event = { kind: "paid" as const, eventId: "evt_dup_1", type: "checkout.session.completed", checkoutId: order.checkout, paymentReference: "pi_dup", amountMinor: 4900, currency: "INR" };
    expect(await processWebhookEvent(supabase, "stripe", event)).toBe("processed");
    expect(await processWebhookEvent(supabase, "stripe", event)).toBe("duplicate");
    expect(await processWebhookEvent(supabase, "stripe", { ...event, eventId: "evt_dup_2" })).toBe("processed");
    expect((await client.query("select count(*)::int as n from public.entitlements where order_id = $1", [order.id])).rows[0].n).toBe(1);
    expect((await client.query("select status from public.orders where id = $1", [order.id])).rows[0].status).toBe("paid");

    const failing = await newOrder();
    expect(await processWebhookEvent(supabase, "stripe", { kind: "failed", eventId: "evt_fail", type: "x", checkoutId: failing.checkout, reason: "declined" })).toBe("processed");
    expect((await client.query("select status from public.orders where id = $1", [failing.id])).rows[0].status).toBe("failed");

    const refund = await processWebhookEvent(supabase, "stripe", { kind: "refunded", eventId: "evt_ref", type: "charge.refunded", paymentReference: "pi_dup", checkoutId: null });
    expect(refund).toBe("processed");
    expect((await client.query("select status from public.entitlements where order_id = $1", [order.id])).rows[0].status).toBe("revoked");
    expect(await processWebhookEvent(supabase, "stripe", { kind: "paid", eventId: "evt_unknown", type: "x", checkoutId: "cs_missing", paymentReference: null, amountMinor: 1, currency: "INR" })).toBe("order_not_found");
  });

  it("keeps private storage closed to clients and rate limits work", async () => {
    await client.query("insert into storage.objects (bucket_id, name, owner) values ('project-assets', $1, $2)", [`${USER_A}/photo.jpg`, USER_A]);
    const seen = await asRole(client, "authenticated", USER_A, async () => (await client.query("select name from storage.objects where bucket_id = 'project-assets'")).rowCount);
    expect(seen).toBe(0);
    const buckets = await client.query("select id, public from storage.buckets order by id");
    expect(buckets.rows).toEqual([{ id: "exports", public: false }, { id: "project-assets", public: false }, { id: "template-previews", public: true }]);
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await client.query("select public.check_rate_limit('test:key', 3600, 3) as ok")).rows[0].ok);
    expect(results).toEqual([true, true, true, false]);
    await expect(asRole(client, "authenticated", USER_A, () => client.query("select public.check_rate_limit('x', 60, 1)"))).rejects.toThrow(/permission denied/);
  });

  it("deleting a user keeps their order records but removes personal data", async () => {
    await client.query("delete from auth.users where id = $1", [USER_A]);
    expect((await client.query("select count(*)::int as n from public.projects where owner_id = $1", [USER_A])).rows[0].n).toBe(0);
    expect((await client.query("select count(*)::int as n from public.profiles where id = $1", [USER_A])).rows[0].n).toBe(0);
    const orders = await client.query("select user_id from public.orders");
    expect(orders.rowCount).toBeGreaterThan(0);
    expect(orders.rows.every((r) => r.user_id === null)).toBe(true);
  });
});
