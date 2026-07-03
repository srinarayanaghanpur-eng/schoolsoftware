import { test, expect } from "playwright/test";

const pages = [
  "/login",
  "/admin/finance",
  "/admin/finance/branch-accounts",
  "/admin/payments",
  "/admin/fee-reports"
];

test.describe("dark mode smoke", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const path of pages) {
      test(`${theme} ${path}`, async ({ page }) => {
        await page.addInitScript(({ theme }) => {
          localStorage.setItem("erp-theme", theme);
          sessionStorage.setItem("erp-auth-role", JSON.stringify({ role: "admin", at: Date.now() }));
        }, { theme });

        await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        await page.screenshot({ path: `output/playwright/${theme}-${path.replaceAll("/", "_") || "root"}.png`, fullPage: true });

        const root = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return {
            dark: document.documentElement.classList.contains("dark"),
            background: style.getPropertyValue("--background").trim(),
            foreground: style.getPropertyValue("--foreground").trim(),
            card: style.getPropertyValue("--card").trim()
          };
        });

        expect(root.dark).toBe(theme === "dark");
        expect(root.background).not.toBe("");
        expect(root.foreground).not.toBe("");
        expect(root.card).not.toBe("");
      });
    }
  }
});
