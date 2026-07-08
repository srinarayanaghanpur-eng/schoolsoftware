import { test, expect, type Page } from "@playwright/test";
import { loginAs, logout, TEST_USERS } from "../helpers/auth";
import {
  ADMIN_ROUTES,
  TEACHER_ROUTES,
  PORTAL_ROUTES,
  RESTRICTED_ROUTES,
  checkPageLoads,
  checkMenuItems,
  checkAccessDenied,
} from "../helpers/navigation";

const ROLES_TO_TEST = Object.keys(TEST_USERS).filter(
  (r) =>
    r === "super_admin" ||
    r === "admin" ||
    r === "principal" ||
    r === "accountant" ||
    r === "teacher" ||
    r === "parent" ||
    r === "settings_manager"
);

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function collectNetworkErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("response", (res) => {
    const status = res.status();
    if (status === 404 || status >= 500) {
      errors.push(`${res.url()} returned ${status}`);
    }
  });
  return errors;
}

test.describe("Auth & RBAC — Login Flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test("Super Admin Login", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const networkErrors = collectNetworkErrors(page);

    await loginAs(page, "super_admin");
    expect(page.url()).not.toContain("/login");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator("nav, aside, [data-testid='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    const body = page.locator("body");
    const bodyText = await body.textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(0);

    expect(await consoleErrors).toEqual([]);
    expect(await networkErrors).toEqual([]);
  });

  test("Admin Login", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const networkErrors = collectNetworkErrors(page);

    await loginAs(page, "admin");
    expect(page.url()).not.toContain("/login");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await expect(page.locator("body")).not.toContainText("permission-denied", { timeout: 5000 });
    await expect(page.locator("body")).not.toContainText("PERMISSION_DENIED", { timeout: 3000 });

    expect(await consoleErrors).toEqual([]);
    expect(await networkErrors).toEqual([]);
  });

  test("Principal Login", async ({ page }) => {
    await loginAs(page, "principal");
    expect(page.url()).not.toContain("/login");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });
    await expect(body).not.toContainText("Settings", { timeout: 3000 });
  });

  test("Accountant Login", async ({ page }) => {
    await loginAs(page, "accountant");
    expect(page.url()).toContain("/admin/finance");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });
  });

  test("Teacher Login", async ({ page }) => {
    await loginAs(page, "teacher");
    expect(page.url()).toContain("/teacher");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });

    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/unauthorized/, { timeout: 10000 });
  });

  test("Parent Login", async ({ page }) => {
    await loginAs(page, "parent");
    expect(page.url()).toContain("/portal");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });

    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/unauthorized/, { timeout: 10000 });
  });

  test("Settings Manager Login", async ({ page }) => {
    await loginAs(page, "settings_manager");
    expect(page.url()).toContain("/admin/settings");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });
  });
});

test.describe("Auth & RBAC — Route Blocking", () => {
  for (const { path, blockedRoles } of RESTRICTED_ROUTES) {
    for (const role of blockedRoles) {
      test(`Block ${role} from ${path}`, async ({ page }) => {
        await loginAs(page, role);
        await page.goto(path, { waitUntil: "networkidle" });

        const body = page.locator("body");
        const bodyText = (await body.textContent())?.toLowerCase() ?? "";
        const denied =
          bodyText.includes("unauthorized") ||
          bodyText.includes("access denied") ||
          bodyText.includes("access_denied") ||
          bodyText.includes("not have permission");

        expect(denied).toBeTruthy();
      });
    }
  }
});

test.describe("Auth & RBAC — Invalid Login", () => {
  test("Invalid credentials show error and stay on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="text"], input[name="employeeId"]', { timeout: 10000 });

    const employeeInput = page
      .locator('input[type="text"], input[name="employeeId"], input[placeholder*="employee" i], input[placeholder*="ID" i]')
      .first();
    await employeeInput.fill("INVALID_USER");

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("WrongPass123");

    await page
      .locator(
        'button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Sign in")'
      )
      .first()
      .click();

    await page.waitForTimeout(3000);

    expect(page.url()).toContain("/login");
    const body = page.locator("body");
    await expect(body).toContainText("incorrect", { timeout: 10000 });
  });
});

test.describe("Auth & RBAC — Session Persistence", () => {
  test("Session persists after page refresh", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
    expect(page.url()).toContain("/admin/dashboard");

    await page.reload({ waitUntil: "networkidle" });

    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/admin/dashboard");

    const body = page.locator("body");
    await expect(body).not.toContainText("Login", { timeout: 5000 });
  });
});

test.describe("Auth & RBAC — Logout", () => {
  test("Logout redirects to login and blocks protected routes", async ({ page }) => {
    await loginAs(page, "admin");

    const signOutBtn = page
      .locator(
        'button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("Sign out")'
      )
      .first();

    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signOutBtn.click();
    } else {
      await page.goto("/login", { waitUntil: "networkidle" });
    }

    await expect(page).toHaveURL(/login/, { timeout: 10000 });

    await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });
});
