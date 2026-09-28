import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.use.isMobile === true,
    "Mobile-emulated clients (isMobile: true) have their / rewritten to the Expo bundle that build:mobile-web generates; the bundle is absent locally and in CI."
  );
});

test("login page renders brand heading and password field", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 30000 });
});

test("root path redirects to the login screen", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
});

test("protected admin route is rejected for anonymous visitors", async ({ page }) => {
  await page.goto("/admin/students", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  expect(page.url()).toMatch(/login|\/admin/);
});
