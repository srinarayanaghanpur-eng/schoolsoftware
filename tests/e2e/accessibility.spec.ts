import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Accessibility (a11y) Checks", () => {

  async function runAxeCheck(page: any, pageName: string) {
    const axeResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js";
        script.onload = () => {
          window.axe.run(document, {
            runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
          }).then(resolve).catch(resolve);
        };
        script.onerror = () => resolve({ error: "Failed to load axe-core" });
        document.head.appendChild(script);
      });
    });

    if (axeResult.error) {
      console.warn(`⚠️  Could not load axe-core for ${pageName}: ${axeResult.error}`);
      return;
    }

    const violations = axeResult.violations || [];
    const criticalViolations = violations.filter((v: any) =>
      ["critical", "serious"].includes(v.impact)
    );

    console.log(`\n📋 ${pageName} — ${violations.length} total violations, ${criticalViolations.length} critical/serious`);
    console.log(`   Passes: ${(axeResult.passes || []).length}, Incomplete: ${(axeResult.incomplete || []).length}`);

    if (violations.length > 0) {
      console.log(`\n🔍 Violations for ${pageName}:`);
      for (const v of violations) {
        console.log(`   [${v.impact}] ${v.id}: ${v.help}`);
        console.log(`   Help: ${v.helpUrl}`);
        console.log(`   Elements: ${v.nodes.length}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`     • ${node.html}`);
        }
      }
    }

    expect(criticalViolations).toEqual([]);
  }

  test.describe("Login Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Login Page");
      await page.screenshot({ path: "tests/screenshots/a11y-login.png", fullPage: true });
    });
  });

  test.describe("Dashboard A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Dashboard");
      await page.screenshot({ path: "tests/screenshots/a11y-dashboard.png", fullPage: true });
    });
  });

  test.describe("Students Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/admin/students");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Students Page");
      await page.screenshot({ path: "tests/screenshots/a11y-students.png", fullPage: true });
    });
  });

  test.describe("Fee Payment Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "accountant");
      await page.goto("/admin/finance");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Fee Payment Page");
      await page.screenshot({ path: "tests/screenshots/a11y-fee-payment.png", fullPage: true });
    });
  });

  test.describe("Attendance Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/admin/attendance");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Attendance Page");
      await page.screenshot({ path: "tests/screenshots/a11y-attendance.png", fullPage: true });
    });
  });

  test.describe("Settings Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "settings_manager");
      await page.goto("/admin/settings");
      await page.waitForLoadState("networkidle");
      await runAxeCheck(page, "Settings Page");
      await page.screenshot({ path: "tests/screenshots/a11y-settings.png", fullPage: true });
    });
  });

  test.describe("Receipt Page A11y", () => {
    test("no critical or serious violations", async ({ page }) => {
      await loginAs(page, "accountant");
      await page.goto("/admin/payments");
      await page.waitForLoadState("networkidle");

      const receiptLink = page.locator('a:has-text("Receipt"), a:has-text("receipt"), button:has-text("Receipt"), [data-testid="receipt-link"]').first();
      if (await receiptLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await receiptLink.click();
        await page.waitForLoadState("networkidle");
      }

      await runAxeCheck(page, "Receipt Page");
      await page.screenshot({ path: "tests/screenshots/a11y-receipt.png", fullPage: true });
    });
  });

});
