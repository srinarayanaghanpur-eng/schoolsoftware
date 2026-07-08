import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Admission Form Module", () => {
  let studentId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  async function pickFirstStudentId(page: any): Promise<string | null> {
    await page.goto("/admin/students", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const admissionLinks = page.locator("a[href*='admission-form']");
    const count = await admissionLinks.count();

    if (count > 0) {
      const href = await admissionLinks.first().getAttribute("href");
      if (href) {
        const match = href.match(/admission-form\/(.+)/);
        if (match) return match[1];
      }
    }

    const studentLinks = page.locator("a[href*='/admin/admission-form/']");
    if ((await studentLinks.count()) > 0) {
      const href = await studentLinks.first().getAttribute("href");
      if (href) {
        const match = href.match(/admission-form\/(.+)/);
        if (match) return match[1];
      }
    }

    return null;
  }

  test("Admission Form Opens", async ({ page }) => {
    const id = await pickFirstStudentId(page);
    if (!id) {
      test.skip();
      return;
    }
    studentId = id;

    const response = await page.goto(`/admin/admission-form/${id}`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    await page.waitForTimeout(1500);

    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/SRI NARAYANA|DIGITAL STUDENT ADMISSION FORM|admission/i);

    const errorText = page.locator("text=Student not found").first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    await page.screenshot({
      path: "tests/screenshots/admission-form-opens.png",
      fullPage: true,
    });
  });

  test("Admission Form Displays Student Details", async ({ page }) => {
    if (!studentId) {
      const id = await pickFirstStudentId(page);
      if (!id) {
        test.skip();
        return;
      }
      studentId = id;
    }

    await page.goto(`/admin/admission-form/${studentId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);

    const bodyText = await page.textContent("body") ?? "";

    const sections = [
      "SRI NARAYANA",
      "ADMISSION DETAILS",
      "STUDENT DETAILS",
      "PARENT",
      "ADDRESS",
      "DECLARATION",
    ];

    const foundSections = sections.filter((s) =>
      bodyText.toUpperCase().includes(s)
    );

    expect(foundSections.length).toBeGreaterThanOrEqual(2);

    const fieldBoxes = page.locator(".field-box, [class*='field-box']");
    const fieldCount = await fieldBoxes.count();
    expect(fieldCount).toBeGreaterThanOrEqual(5);

    await page.screenshot({
      path: "tests/screenshots/admission-form-details.png",
      fullPage: true,
    });
  });

  test("Admission Form Prints Without Horizontal Overflow", async ({ page }) => {
    if (!studentId) {
      const id = await pickFirstStudentId(page);
      if (!id) {
        test.skip();
        return;
      }
      studentId = id;
    }

    await page.goto(`/admin/admission-form/${studentId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBeFalsy();

    await page.screenshot({
      path: "tests/screenshots/admission-form-no-overflow.png",
      fullPage: true,
    });
  });

  test("Admission Form Mobile Layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    if (!studentId) {
      const id = await pickFirstStudentId(page);
      if (!id) {
        test.skip();
        return;
      }
      studentId = id;
    }

    await page.goto(`/admin/admission-form/${studentId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBeFalsy();

    const scrollHeight = await page.evaluate(() =>
      document.documentElement.scrollHeight
    );
    const viewportHeight = 844;
    expect(scrollHeight).toBeGreaterThan(viewportHeight);

    const inputs = page.locator("input, select, textarea, button, a");
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);

    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/SRI NARAYANA|student/i);

    await page.screenshot({
      path: "tests/screenshots/admission-form-mobile.png",
      fullPage: true,
    });
  });
});
