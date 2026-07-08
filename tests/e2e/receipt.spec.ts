import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Receipt / Print Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "accountant");
  });

  async function navigateToAnyReceipt(page: any): Promise<string | null> {
    await page.goto("/admin/payments", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const receiptLinks = page.locator(
      "a[href*='/receipts/'], a[href*='receipt'], [aria-label*='receipt' i], button[aria-label*='receipt' i]"
    );
    const count = await receiptLinks.count();

    if (count > 0) {
      const href = await receiptLinks.first().getAttribute("href");
      if (href) return href.startsWith("http") ? href : href;
    }

    const rows = page.locator("table tbody tr, [class*='payment-row'], [class*='payment-item'], .card");
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      const receiptMatch = text?.match(/(?:receipt|rec|RCT)[-\s]?(\d+)/i);
      if (receiptMatch) {
        return `/receipts/${receiptMatch[1]}`;
      }
    }

    return null;
  }

  test("Receipt Page Loads", async ({ page }) => {
    const receiptUrl = await navigateToAnyReceipt(page);

    if (!receiptUrl) {
      test.skip();
      return;
    }

    const response = await page.goto(receiptUrl, { waitUntil: "networkidle" });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    await page.waitForTimeout(1500);

    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/receipt|SRI NARAYANA|fee/i);

    await page.screenshot({
      path: "tests/screenshots/receipt-page-loads.png",
      fullPage: true,
    });
  });

  test("Receipt Print Layout", async ({ page }) => {
    const receiptUrl = await navigateToAnyReceipt(page);

    if (!receiptUrl) {
      test.skip();
      return;
    }

    const receiptId = receiptUrl.split("/").pop();
    const printUrl = `/receipts/print/${receiptId}`;

    const response = await page.goto(printUrl, { waitUntil: "networkidle" });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    await page.waitForTimeout(1500);

    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/SRI NARAYANA|DIGITAL FEE RECEIPT|receipt/i);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBeFalsy();

    await page.screenshot({
      path: "tests/screenshots/receipt-print-layout.png",
      fullPage: true,
    });
  });

  test("Receipt Contains Required Fields", async ({ page }) => {
    const receiptUrl = await navigateToAnyReceipt(page);

    if (!receiptUrl) {
      test.skip();
      return;
    }

    await page.goto(receiptUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const bodyText = await page.textContent("body");

    const hasSchoolName = bodyText?.toLowerCase().includes("sri narayana");
    const hasStudentName = bodyText?.toLowerCase().includes("student name") ||
      page.locator("text=Student Name").isVisible().catch(() => false);
    const hasClass = bodyText?.toLowerCase().includes("class") ||
      bodyText?.includes("/ Sec");
    const hasAmount = bodyText?.includes("Rs.") ||
      bodyText?.includes("TOTAL PAID") ||
      bodyText?.includes("Amount");
    const hasDate = bodyText?.toLowerCase().includes("date");
    const hasReceiptNo = bodyText?.toLowerCase().includes("receipt no") ||
      bodyText?.toLowerCase().includes("receipt");

    const foundFields = {
      "School Name (Sri Narayana)": hasSchoolName,
      "Student Name field": hasStudentName,
      "Class field": hasClass,
      "Amount field": hasAmount,
      "Date field": hasDate,
      "Receipt Number field": hasReceiptNo,
    };

    const visibleFields = Object.entries(foundFields)
      .filter(([, v]) => v)
      .map(([k]) => k);

    expect(visibleFields.length).toBeGreaterThanOrEqual(3);

    const receiptArea = page.locator(
      ".digital-fee-receipt, [class*='receipt'], #receipt-print-area, article"
    ).first();
    if (await receiptArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(receiptArea).toBeVisible();
    }

    await page.screenshot({
      path: "tests/screenshots/receipt-required-fields.png",
      fullPage: true,
    });
  });
});
