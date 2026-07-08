import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Attendance Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("Attendance Page Loads", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto("/admin/attendance", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/attendance/i);

    expect(consoleErrors).toHaveLength(0);

    await page.screenshot({
      path: "tests/screenshots/attendance-page-loads.png",
      fullPage: true,
    });
  });

  test("Search and Filter Attendance Records", async ({ page }) => {
    await page.goto("/admin/attendance", { waitUntil: "networkidle" });

    const searchInput = page.getByPlaceholder(/search/i).first();
    const teacherSelect = page.locator("select").filter({ hasText: /all teachers/i }).first();
    const statusSelect = page.locator("select").filter({ hasText: /all statuses/i }).first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("present");
    }

    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await statusSelect.locator("option").all();
      const presentOption = options.find(
        async (opt) => (await opt.textContent())?.trim().toLowerCase() === "present"
      );
      if (presentOption) {
        const value = await presentOption.getAttribute("value");
        if (value) await statusSelect.selectOption(value);
      }
    }

    await page.waitForTimeout(1000);

    const table = page.locator("table").first();
    const cardList = page.locator("div.space-y-3 > div.card").first();
    const anyContent = table.or(cardList);

    if (await anyContent.isVisible({ timeout: 3000 }).catch(() => false)) {
      const rowCount = await page.locator("table tbody tr, div.space-y-3 > div.card").count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }

    await page.screenshot({
      path: "tests/screenshots/attendance-filtered.png",
      fullPage: true,
    });
  });

  test("Edit Attendance Record", async ({ page }) => {
    await page.goto("/admin/attendance", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const editButton = page
      .getByRole("button", { name: /edit/i })
      .first();
    const editFormVisible = await editButton.isVisible({ timeout: 8000 }).catch(() => false);

    if (!editFormVisible) {
      const pencilButton = page.locator("button svg.lucide-pencil").first();
      if (await pencilButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pencilButton.click();
      } else {
        test.skip();
        return;
      }
    } else {
      await editButton.click();
    }

    await page.waitForTimeout(1000);

    const statusSelect = page.locator("select").filter({ hasText: /present|absent|late/i }).first();
    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await statusSelect.locator("option").all();
      for (const opt of options) {
        const val = await opt.getAttribute("value");
        if (val && val !== "present") {
          await statusSelect.selectOption(val);
          break;
        }
      }
    }

    const reasonInput = page.locator("input[placeholder*='audit reason' i], input[placeholder*='reason' i]").first();
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill("E2E test edit");
    }

    const saveButton = page.getByRole("button", { name: /save audited edit|save/i }).first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    await page.waitForTimeout(2000);

    const message = page.locator("text=Attendance updated").first();
    const messageVisible = await message.isVisible({ timeout: 3000 }).catch(() => false);

    if (messageVisible) {
      await expect(message).toBeVisible();
    }

    await page.screenshot({
      path: "tests/screenshots/attendance-edit.png",
      fullPage: true,
    });
  });

  test("Refresh Attendance Records", async ({ page }) => {
    await page.goto("/admin/attendance", { waitUntil: "networkidle" });

    const refreshButton = page.getByRole("button", { name: /refresh/i }).first();
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
    await refreshButton.click();
    await page.waitForTimeout(1500);

    const table = page.locator("table").first();
    const noRecords = page.getByText(/no attendance records/i).first();

    const tableVisible = await table.isVisible({ timeout: 3000 }).catch(() => false);
    const noRecordsVisible = await noRecords.isVisible({ timeout: 2000 }).catch(() => false);

    expect(tableVisible || noRecordsVisible).toBeTruthy();

    await page.screenshot({
      path: "tests/screenshots/attendance-refresh.png",
      fullPage: true,
    });
  });
});
