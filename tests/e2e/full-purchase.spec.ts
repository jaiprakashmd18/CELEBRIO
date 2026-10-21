import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Full customer journey against a LOCAL Supabase stack (`supabase start`) and
 * the development payment simulator. Never run this against production.
 *
 * Required environment (see README → Testing):
 *   E2E_SUPABASE=1
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY  (local stack)
 *   PAYMENT_PROVIDER=simulator  SIMULATOR_WEBHOOK_SECRET=<16+ chars>
 *   MAILPIT_URL (default http://127.0.0.1:54324)
 */
const enabled = process.env.E2E_SUPABASE === "1";
test.skip(!enabled, "Set E2E_SUPABASE=1 with a local Supabase stack to run the purchase journey.");
test.describe.configure({ mode: "serial" });

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const password = "Correct-Horse-42";
const emailA = `buyer-${Date.now()}@example.com`;
const emailB = `other-${Date.now()}@example.com`;
let projectId = "";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function verificationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const link = /href="([^"]+)"/.exec(msg.HTML ?? "")?.[1] ?? /(https?:\/\/\S+)/.exec(msg.Text ?? "")?.[1];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No verification email for ${email}`);
}

async function signUpAndVerify(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.goto(await verificationLink(email));
  await expect(page).toHaveURL(/\/dashboard/);
}

test("3–4. sign up, verify email, save and reopen a draft", async ({ page }) => {
  await signUpAndVerify(page, emailA);
  await page.goto("/editor/new?template=peach-confetti");
  await page.getByLabel("Birthday star's name").fill("Ira");
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  projectId = page.url().split("/editor/")[1]!.split("?")[0]!;
  await page.goto("/dashboard/drafts");
  await page.getByRole("link", { name: /Edit/ }).first().click();
  await expect(page.getByLabel("Birthday star's name")).toHaveValue("Ira");
});

test("5–6. upload and crop a photo, change text and preview", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto(`/editor/${projectId}`);
  await page.setInputFiles("#photo-photo", "public/templates/samples/graduate.jpg");
  await expect(page.getByText("Your photo")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Zoom").fill("1.6");
  await page.getByLabel("Venue name").fill("Lakeview Hall");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog", { name: "Invitation preview" }).locator("text", { hasText: "CELEBRIO PREVIEW" }).first()).toBeAttached();
});

test("11–13. unpaid exports are refused, other users are blocked, prices can't be changed", async ({ page, browser }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
  const denied = await page.request.post("/api/exports", { data: { projectId, format: "portrait", fileType: "png" }, headers: { origin: new URL(page.url()).origin } });
  expect(denied.status()).toBe(402);

  const other = await browser.newPage();
  await signUpAndVerify(other, emailB);
  expect((await other.request.get(`/api/projects/${projectId}`)).status()).toBe(404);
  expect((await other.goto(`/editor/${projectId}`))?.status()).toBe(404);
  const otherExport = await other.request.post("/api/exports", { data: { projectId, format: "portrait", fileType: "png" }, headers: { origin: new URL(other.url()).origin } });
  expect(otherExport.status()).toBe(404);
  await other.close();

  const res = await page.request.post("/api/checkout", { data: { projectId, package: "single_format", amount: 1, amountMinor: 1, price: 1 }, headers: { origin: new URL(page.url()).origin } });
  expect(res.ok()).toBeTruthy();
  const { orderId } = await res.json();
  const order = await (await page.request.get(`/api/orders/${orderId}`)).json();
  expect(order).toMatchObject({ status: "pending", amount_minor: 4900, currency: "INR" });
});

test("7–10, 14. pay with the simulator, webhook grants access once, download PNG and PDF", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto(`/checkout/${projectId}`);
  await page.getByRole("button", { name: /Pay ₹49 securely/ }).click();
  await expect(page).toHaveURL(/\/checkout\/simulator/);
  const checkoutId = new URL(page.url()).searchParams.get("checkout")!;
  await page.getByRole("button", { name: "Pay (test success)" }).click();
  await expect(page.getByRole("heading", { name: "Your invitation is unlocked" })).toBeVisible({ timeout: 30_000 });

  // Replaying the exact same signed webhook must not create a second entitlement.
  const { data: order } = await admin().from("orders").select("id, amount_minor, currency").eq("provider_checkout_id", checkoutId).single();
  const body = JSON.stringify({ id: `replay-${randomUUID()}`, type: "payment.succeeded", checkoutId, amountMinor: order!.amount_minor, currency: order!.currency });
  const sig = createHmac("sha256", process.env.SIMULATOR_WEBHOOK_SECRET!).update(body).digest("hex");
  for (let i = 0; i < 2; i++) {
    const r = await page.request.post("/api/webhooks/simulator", { data: body, headers: { "content-type": "application/json", "x-celebrio-simulator-signature": sig } });
    expect(r.ok()).toBeTruthy();
  }
  const { count } = await admin().from("entitlements").select("id", { count: "exact", head: true }).eq("order_id", order!.id);
  expect(count).toBe(1);

  await page.goto("/dashboard/invitations");
  for (const [label, type] of [["PNG", "image/png"], ["PDF (print)", "application/pdf"]] as const) {
    const exportResponse = page.waitForResponse((r) => r.url().endsWith("/api/exports") && r.request().method() === "POST");
    await page.getByRole("button", { name: label }).first().click();
    const json = await (await exportResponse).json();
    const file = await page.request.get(json.url);
    expect(file.headers()["content-type"]).toContain(type);
  }
});

test("15–16. an administrator publishes a new template that works in both editor modes", async ({ page }) => {
  const adminEmail = `admin-${Date.now()}@example.com`;
  await signUpAndVerify(page, adminEmail);
  const { data: users } = await admin().auth.admin.listUsers();
  const adminUser = users.users.find((u) => u.email === adminEmail)!;
  await admin().from("admin_users").insert({ user_id: adminUser.id, note: "e2e" });

  await page.goto("/admin/templates/new");
  const slug = `e2e-${Date.now()}`;
  await page.getByLabel("Name").fill("E2E Celebration");
  await page.getByLabel("URL slug").fill(slug);
  await page.getByRole("button", { name: "Create draft template" }).click();
  await expect(page.getByText("Template created as a draft.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Generate from design" }).click();
  await expect(page.getByText("Preview image updated.")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "publish", exact: true }).click();
  await expect(page.getByText("Published").first()).toBeVisible();

  await page.goto(`/templates?q=${slug}`);
  await page.goto(`/templates/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: "E2E Celebration" })).toBeVisible();
  await page.getByRole("link", { name: /Customize this design/ }).click();
  await expect(page.getByRole("img", { name: /live preview/ })).toBeVisible();
  await page.getByRole("group", { name: "Editing mode" }).first().getByRole("button", { name: "Advanced" }).click();
  await expect(page.getByRole("img", { name: /editing canvas/ })).toBeVisible();
});
