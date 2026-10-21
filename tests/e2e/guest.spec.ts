import { expect, test } from "@playwright/test";

test.describe("guest experience", () => {
  test("1. a guest browses, filters and searches templates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Moments Deserve Something Beautiful.");
    await page.getByRole("link", { name: "Explore Templates" }).click();
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByText(/\d+ designs/)).toBeVisible();
    const cards = page.locator("article");
    expect(await cards.count()).toBeGreaterThanOrEqual(12);

    await page.goto("/invitations/wedding");
    await expect(page.getByRole("heading", { name: "Wedding invitations" })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(2);

    await page.goto("/templates?q=neon");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article").getByRole("heading")).toHaveText("Neon Night");

    await page.locator("article a").first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Neon Night" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Neon Night — Portrait preview/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You may also like" })).toBeVisible();
  });

  test("2. a guest personalises a template in both editor modes and keeps their work", async ({ page }) => {
    await page.goto("/templates/peach-confetti");
    await page.getByRole("link", { name: /Customize this design/ }).click();
    await expect(page).toHaveURL(/\/editor\/new\?template=peach-confetti/);

    await page.getByLabel("Birthday star's name").fill("Zoya");
    const preview = page.getByRole("img", { name: /live preview/ });
    await expect(preview.locator("text", { hasText: "Zoya" })).toHaveCount(1);

    // Change colours and format.
    await page.getByRole("button", { name: /Mint sorbet/ }).click();
    await page.getByRole("button", { name: /Square/ }).first().click();

    // Advanced mode shares the same project data.
    await page.getByRole("group", { name: "Editing mode" }).first().getByRole("button", { name: "Advanced" }).click();
    await expect(page.getByRole("img", { name: /editing canvas/ }).locator("text", { hasText: "Zoya" })).toHaveCount(1);
    await page.getByRole("button", { name: "Add text" }).click();
    await expect(page.getByRole("complementary", { name: "Properties" }).getByText("Custom text")).toBeVisible();

    await expect(page.getByText("Saved on this device")).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByText(/Welcome back/)).toBeVisible();
    await expect(page.getByRole("img", { name: /editing canvas/ }).locator("text", { hasText: "Zoya" })).toHaveCount(1);

    // Preview is watermarked; unlocking asks the guest to create an account.
    await page.getByRole("button", { name: "Preview" }).click();
    const dialog = page.getByRole("dialog", { name: "Invitation preview" });
    await expect(dialog.locator("text", { hasText: "CELEBRIO PREVIEW" }).first()).toBeAttached();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Unlock/ }).first().click();
    await expect(page.getByRole("heading", { name: "Save your invitation" })).toBeVisible();
  });

  test("3. paid exports and payment endpoints refuse unauthenticated or forged requests", async ({ request }) => {
    const exportRes = await request.post("/api/exports", { data: { projectId: "0b8f4c8e-5d0e-4b0a-9c1f-3f7c2a1e9d11", format: "portrait", fileType: "png" } });
    expect([401, 503]).toContain(exportRes.status());
    expect(exportRes.headers()["content-type"]).toContain("application/json");

    const checkoutRes = await request.post("/api/checkout", { data: { projectId: "0b8f4c8e-5d0e-4b0a-9c1f-3f7c2a1e9d11", package: "single_format", amount: 1 } });
    expect([401, 503]).toContain(checkoutRes.status());

    const forged = await request.post("/api/webhooks/stripe", { data: '{"type":"checkout.session.completed"}', headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" } });
    expect([400, 500]).toContain(forged.status());
    const unknown = await request.post("/api/webhooks/paypal", { data: "{}" });
    expect(unknown.status()).toBe(404);

    const crossSite = await request.post("/api/contact", { data: { name: "x" }, headers: { origin: "https://evil.example" } });
    expect(crossSite.status()).toBe(403);
  });

  test("4. protected pages require sign-in and errors are friendly", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: /slipped off the guest list/ })).toBeVisible();
  });

  test("5. SEO essentials are present", async ({ request, page }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("/templates/peach-confetti");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /dashboard");
    await page.goto("/templates/golden-years");
    await expect(page).toHaveTitle(/Golden Years/);
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain("/templates/golden-years");
  });

  test("mobile layouts have no horizontal overflow @mobile", async ({ page }) => {
    for (const path of ["/", "/templates", "/templates/little-star", "/pricing", "/editor/new?template=little-star"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await page.goto("/editor/new?template=little-star");
    await page.getByLabel("Honouring").fill("Nia & Sam");
    await expect(page.getByRole("img", { name: /live preview/ }).locator("text", { hasText: "Nia & Sam" })).toHaveCount(1);
  });
});
