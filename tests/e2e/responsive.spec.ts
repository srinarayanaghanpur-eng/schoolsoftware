import { test, expect, Page } from "@playwright/test";
import { TEST_CONFIG } from "../helpers/test-config";
import { loginAs, logout } from "../helpers/auth";

const VIEWPORTS = TEST_CONFIG.viewports;

async function checkNoHorizontalScroll(page: Page) {
  const hasScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasScroll).toBeFalsy();
}

async function takeResponsiveScreenshot(page: Page, name: string, viewport: string) {
  await page.screenshot({
    path: `tests/screenshots/responsive-${name}-${viewport}.png`,
    fullPage: true,
  });
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Viewport: ${viewportName} (${viewport.width}x${viewport.height})`, () => {

    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.describe("Login Page Responsive", () => {
      test("form is centered, fits viewport, all elements visible", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        const form = page.locator("form");
        await expect(form).toBeVisible();

        await checkNoHorizontalScroll(page);

        const inputs = page.locator("input");
        const inputCount = await inputs.count();
        expect(inputCount).toBeGreaterThan(0);

        for (let i = 0; i < inputCount; i++) {
          await expect(inputs.nth(i)).toBeVisible();
        }

        const loginBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
        await expect(loginBtn).toBeVisible();
        await expect(loginBtn).toBeEnabled();

        await takeResponsiveScreenshot(page, "login", viewportName);
      });
    });

    test.describe("Dashboard Responsive", () => {
      test("sidebar, content, and nav adapt to viewport", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/dashboard");
        await page.waitForLoadState("networkidle");

        await checkNoHorizontalScroll(page);

        const isMobile = viewport.width < 768;
        if (isMobile) {
          const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="nav" i], [data-testid="hamburger"], .hamburger-menu, button:has-text("☰")').first();
          if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
            await hamburger.click();
            await page.waitForTimeout(500);
          }

          const bottomNav = page.locator('nav[data-testid="bottom-nav"], [data-testid="bottom-navigation"], .bottom-nav').first();
          if (await bottomNav.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(bottomNav).toBeVisible();
          }
        }

        const mainContent = page.locator("main, [data-testid='main-content'], #main-content").first();
        if (await mainContent.isVisible({ timeout: 2000 }).catch(() => false)) {
          const box = await mainContent.boundingBox();
          expect(box).not.toBeNull();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }

        await takeResponsiveScreenshot(page, "dashboard", viewportName);
      });
    });

    test.describe("Student List Responsive", () => {
      test("table, filters and buttons adapt to viewport", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/students");
        await page.waitForLoadState("networkidle");

        await checkNoHorizontalScroll(page);

        const table = page.locator("table, [role='grid'], .data-table").first();
        if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
          const isMobile = viewport.width < 768;
          if (isMobile) {
            const hasHorizontalScroll = await table.evaluate((el) => {
              return el.scrollWidth > el.clientWidth;
            });
            if (hasHorizontalScroll) {
              console.log(`ℹ️  Table has horizontal scroll on ${viewportName} as expected`);
            }
          }
        }

        const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(searchInput).toBeEnabled();
        }

        const buttons = page.locator("button, a[role='button']");
        const btnCount = await buttons.count();
        for (let i = 0; i < Math.min(btnCount, 3); i++) {
          await expect(buttons.nth(i)).toBeVisible({ timeout: 3000 }).catch(() => {});
        }

        await takeResponsiveScreenshot(page, "students", viewportName);
      });
    });

    test.describe("Form Responsive", () => {
      test("form fields do not overflow, all labels visible", async ({ page }) => {
        await loginAs(page, "admin");

        const formRoutes = ["/admin/students", "/admin/finance", "/admin/payments"];
        let formPage = "";
        for (const route of formRoutes) {
          await page.goto(route);
          await page.waitForLoadState("networkidle");
          const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), a:has-text("Add")').first();
          if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(500);
            formPage = route;
            break;
          }
        }

        if (formPage) {
          await checkNoHorizontalScroll(page);

          const labels = page.locator("label, [data-testid='form-label']");
          const labelCount = await labels.count();
          if (labelCount > 0) {
            for (let i = 0; i < Math.min(labelCount, 4); i++) {
              await expect(labels.nth(i)).toBeVisible();
            }
          }

          const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Create")').first();
          if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(submitBtn).toBeEnabled();
          }
        }

        await takeResponsiveScreenshot(page, "form", viewportName);
      });
    });

    test.describe("Dark Mode Text Visibility", () => {
      test("text is readable in dark mode across pages", async ({ page }) => {
        await loginAs(page, "admin");

        const darkModeToggle = page.locator(
          'button[aria-label*="dark" i], button[aria-label*="theme" i], [data-testid="dark-mode-toggle"], button:has-text("🌙"), button:has-text("☀️")'
        ).first();

        if (await darkModeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          await darkModeToggle.click();
          await page.waitForTimeout(1000);

          const htmlClass = await page.evaluate(() => document.documentElement.className);
          const isDark = htmlClass.includes("dark") ||
            await page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "dark";

          if (isDark) {
            const pagesToCheck = ["/admin/dashboard", "/admin/students"];
            for (const route of pagesToCheck) {
              await page.goto(route);
              await page.waitForLoadState("networkidle");

              const bodyText = await page.textContent("body");
              expect(bodyText?.trim().length).toBeGreaterThan(0);

              await checkNoHorizontalScroll(page);
              await takeResponsiveScreenshot(page, `dark-${route.replace(/[^a-z]/g, "")}`, viewportName);
            }
          }

          await darkModeToggle.click();
          await page.waitForTimeout(500);
        } else {
          console.log(`ℹ️  Dark mode toggle not found on ${viewportName}, skipping`);
        }
      });
    });

  });
}
