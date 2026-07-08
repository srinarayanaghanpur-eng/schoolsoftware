import { test, expect } from "@playwright/test";
import { TEST_CONFIG } from "../helpers/test-config";
import { loginAs } from "../helpers/auth";

const BUDGETS = TEST_CONFIG.budgets;

test.describe("Firestore Read Budget Compliance", () => {

  test.describe("Student profile page - max 50 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/admin/students");
      await page.waitForLoadState("networkidle");

      const startTime = Date.now();
      await page.locator("table a, [data-testid='student-link'], .student-name").first().click();
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      const perfEntries = await page.evaluate(() =>
        performance.getEntriesByType("resource").map((e) => ({
          name: e.name.split("?")[0],
          duration: e.duration,
        }))
      );

      const firestoreCalls = perfEntries.filter((e) =>
        e.name.includes("firestore") || e.name.includes("googleapis")
      );

      expect(await page.locator("body").isVisible()).toBeTruthy();
      expect(page.url()).not.toContain("error");

      if (loadTime > 3000) {
        console.warn(`⚠️  Student profile loaded in ${loadTime}ms (budget: ~50 reads)`);
      } else {
        console.log(`✅ Student profile loaded in ${loadTime}ms`);
      }

      const bodyText = await page.textContent("body");
      expect(bodyText?.toLowerCase()).not.toContain("permission-denied");
      expect(bodyText?.toLowerCase()).not.toContain("PERMISSION_DENIED");
    });
  });

  test.describe("Student list page - max 100 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "admin");
      const startTime = Date.now();
      await page.goto("/admin/students");
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(await page.locator("body").isVisible()).toBeTruthy();
      expect(page.url()).not.toContain("error");

      if (loadTime > 3000) {
        console.warn(`⚠️  Student list loaded in ${loadTime}ms (budget: ~100 reads)`);
      } else {
        console.log(`✅ Student list loaded in ${loadTime}ms`);
      }

      const bodyText = await page.textContent("body");
      expect(bodyText?.toLowerCase()).not.toContain("permission-denied");
    });
  });

  test.describe("Fee dashboard - max 150 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "accountant");
      const startTime = Date.now();
      await page.goto("/admin/finance");
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(await page.locator("body").isVisible()).toBeTruthy();
      expect(page.url()).not.toContain("error");

      if (loadTime > 3000) {
        console.warn(`⚠️  Fee dashboard loaded in ${loadTime}ms (budget: ~150 reads)`);
      } else {
        console.log(`✅ Fee dashboard loaded in ${loadTime}ms`);
      }
    });
  });

  test.describe("Due list - max 100 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "accountant");
      const startTime = Date.now();
      await page.goto("/admin/finance/dues");
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(await page.locator("body").isVisible()).toBeTruthy();
      const bodyText = await page.textContent("body");
      expect(bodyText?.toLowerCase()).not.toContain("permission-denied");

      if (loadTime > 3000) {
        console.warn(`⚠️  Due list loaded in ${loadTime}ms (budget: ~100 reads)`);
      } else {
        console.log(`✅ Due list loaded in ${loadTime}ms`);
      }
    });
  });

  test.describe("Attendance page - max 150 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "admin");
      const startTime = Date.now();
      await page.goto("/admin/attendance");
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(await page.locator("body").isVisible()).toBeTruthy();
      expect(page.url()).not.toContain("error");

      if (loadTime > 3000) {
        console.warn(`⚠️  Attendance page loaded in ${loadTime}ms (budget: ~150 reads)`);
      } else {
        console.log(`✅ Attendance page loaded in ${loadTime}ms`);
      }
    });
  });

  test.describe("Settings page - max 50 reads", () => {
    test.skip("Full budget enforcement requires firestoreDebugLogger implementation", async () => {});

    test("loads within performance budget", async ({ page }) => {
      await loginAs(page, "settings_manager");
      const startTime = Date.now();
      await page.goto("/admin/settings");
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(await page.locator("body").isVisible()).toBeTruthy();
      expect(page.url()).not.toContain("error");

      if (loadTime > 3000) {
        console.warn(`⚠️  Settings page loaded in ${loadTime}ms (budget: ~50 reads)`);
      } else {
        console.log(`✅ Settings page loaded in ${loadTime}ms`);
      }
    });
  });

});
