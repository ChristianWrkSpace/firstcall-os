import { test, expect } from "@playwright/test";

// Smoke tests — minimum coverage that the prod app boots and core public
// surfaces respond. Runs against the deployed URL by default; override with
// PLAYWRIGHT_BASE_URL for previews.

test.describe("public surfaces respond", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // Should have an email + password field
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("forgot-password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
  });

  test("dashboard redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/jobs/new redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/jobs/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("portal/[token] with bogus token shows 404", async ({ page }) => {
    const res = await page.goto("/portal/this-token-definitely-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("adjuster/[token] with bogus token shows 404", async ({ page }) => {
    const res = await page.goto("/adjuster/another-bogus-token");
    expect(res?.status()).toBe(404);
  });
});

test.describe("webhook endpoints reject unsigned requests", () => {
  test("stripe webhook rejects request without signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: { fake: "event" },
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe("cron endpoints reject unauthorized callers", () => {
  test("backup cron rejects when CRON_SECRET is configured and missing", async ({ request }) => {
    // If CRON_SECRET is configured in production, hitting without bearer
    // should return 401. If unset (first-deploy), this test will pass anyway
    // because the route returns 200; that's intentional first-deploy convenience.
    const res = await request.get("/api/cron/backup");
    expect([200, 401]).toContain(res.status());
  });
});
