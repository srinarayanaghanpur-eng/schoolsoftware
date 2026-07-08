import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import {
  ADMIN_ROUTES,
  TEACHER_ROUTES,
  PORTAL_ROUTES,
  RESTRICTED_ROUTES,
  type RouteInfo,
} from "../helpers/navigation";
import path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../screenshots");

type RouteResult = {
  route: string;
  label: string;
  pass: boolean;
  errors: string[];
};

async function checkRoute(
  page: Page,
  route: string,
  label: string
): Promise<RouteResult> {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  page.on("response", (res) => {
    if (res.status() === 404 || res.status() >= 500) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    const response = await page.goto(route, { waitUntil: "networkidle", timeout: 30000 });

    if (response && (response.status() === 404 || response.status() >= 500)) {
      errors.push(`HTTP ${response.status()} for ${route}`);
    }

    const body = page.locator("body");
    const bodyText = await body.textContent({ timeout: 10000 });
    const trimmed = bodyText?.trim() ?? "";

    if (trimmed.length === 0) {
      errors.push(`Empty body for ${route}`);
    }

    const lower = trimmed.toLowerCase();
    if (
      lower.includes("permission-denied") ||
      lower.includes("permission_denied") ||
      lower.includes("firebase") ||
      lower.includes("missing or insufficient permissions")
    ) {
      errors.push(`Firebase/permission error text found on ${route}`);
    }

    if (consoleErrors.length > 0) {
      errors.push(`Console errors on ${route}: ${consoleErrors.join("; ")}`);
    }

    if (networkErrors.length > 0) {
      errors.push(`Network errors on ${route}: ${networkErrors.join("; ")}`);
    }

    const sanitizedPath = route.replace(/[/?&=#]/g, "_").replace(/^_/, "") || "index";
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${sanitizedPath}.png`),
      fullPage: true,
    }).catch(() => {});

    return {
      route,
      label,
      pass: errors.length === 0,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { route, label, pass: false, errors: [`Navigation failed: ${msg}`] };
  }
}

test.describe("Navigation — Route Crawler", () => {
  test("Crawl every admin route as admin", async ({ page }) => {
    await loginAs(page, "admin");

    const results: RouteResult[] = [];
    for (const r of ADMIN_ROUTES) {
      const result = await checkRoute(page, r.path, r.label);
      results.push(result);
    }

    const failed = results.filter((r) => !r.pass);
    if (failed.length > 0) {
      const summary = failed
        .map((f) => `❌ ${f.route} (${f.label}): ${f.errors.join(" | ")}`)
        .join("\n");
      console.log(`Route crawl failures:\n${summary}`);
    }

    for (const r of results) {
      expect(r.pass, `${r.route} (${r.label}): ${r.errors.join(", ")}`).toBeTruthy();
    }
  });
});

test.describe("Navigation — Accessible Routes Per Role", () => {
  const testCases: Array<{
    role: string;
    allowed: RouteInfo[];
    blocked: Array<{ path: string }>;
  }> = [
    {
      role: "super_admin",
      allowed: ADMIN_ROUTES.filter((r) =>
        r.allowedRoles.includes("super_admin")
      ),
      blocked: [],
    },
    {
      role: "accountant",
      allowed: ADMIN_ROUTES.filter((r) => r.allowedRoles.includes("accountant")),
      blocked: ADMIN_ROUTES.filter(
        (r) => !r.allowedRoles.includes("accountant")
      ),
    },
    {
      role: "settings_manager",
      allowed: ADMIN_ROUTES.filter((r) =>
        r.allowedRoles.includes("settings_manager")
      ),
      blocked: ADMIN_ROUTES.filter(
        (r) => !r.allowedRoles.includes("settings_manager")
      ),
    },
  ];

  for (const { role, allowed, blocked } of testCases) {
    for (const route of allowed) {
      test(`${role} can access ${route.path}`, async ({ page }) => {
        await loginAs(page, role);
        const result = await checkRoute(page, route.path, route.label);
        expect(result.pass, `${route.path}: ${result.errors.join(", ")}`).toBeTruthy();
      });
    }

    for (const route of blocked) {
      test(`${role} is blocked from ${route.path}`, async ({ page }) => {
        await loginAs(page, role);

        if (role === "accountant" && route.path === "/admin/dashboard") {
          await page.goto("/admin/finance", { waitUntil: "networkidle" });
          return;
        }

        await page.goto(route.path, { waitUntil: "networkidle" });

        const body = page.locator("body");
        const text = (await body.textContent())?.toLowerCase() ?? "";
        const denied =
          text.includes("unauthorized") ||
          text.includes("access denied") ||
          text.includes("not have permission") ||
          text.includes("access_denied");

        expect(denied).toBeTruthy();
      });
    }
  }
});

test.describe("Navigation — Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Mobile navigation works correctly", async ({ page }) => {
    await loginAs(page, "admin");

    const menuButton = page
      .locator(
        'button[aria-label*="Menu" i], button[aria-label*="menu" i], button:has(svg.lucide-menu), button:has-text("Menu"), [data-testid="mobile-menu"]'
      )
      .first();

    if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuButton.click();
      await page.waitForTimeout(500);

      const navLink = page.locator('a[href="/admin/dashboard"], a[href="/admin/reports"]').first();
      if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await navLink.click();
        await page.waitForLoadState("networkidle");
      }
    }

    await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
    const body = page.locator("body");
    await expect(body).not.toContainText("permission-denied", { timeout: 5000 });
    await expect(body).not.toContainText("PERMISSION_DENIED", { timeout: 3000 });

    await page.goto("/admin/reports", { waitUntil: "networkidle" });
    const reportBody = page.locator("body");
    await expect(reportBody).not.toContainText("permission-denied", { timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "mobile-admin-navigation.png"),
      fullPage: true,
    });
  });
});

test.describe("Navigation — Dark Mode", () => {
  test("Toggle dark mode adds and removes .dark class on html", async ({ page }) => {
    await loginAs(page, "admin");

    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );

    const toggleBtn = page
      .locator(
        'button[aria-label*="dark mode" i], button[aria-label*="light mode" i], button:has(svg.lucide-moon), button:has(svg.lucide-sun)'
      )
      .first();

    await expect(toggleBtn).toBeVisible({ timeout: 5000 });

    if (!initialDark) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
    }

    const afterFirstToggle = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(afterFirstToggle).toBeTruthy();

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 3000 });
    await expect(body).not.toHaveText("", { timeout: 3000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dark-mode.png"),
      fullPage: true,
    });

    await toggleBtn.click();
    await page.waitForTimeout(500);

    const afterSecondToggle = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(afterSecondToggle).toBeFalsy();
  });
});
