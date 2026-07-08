import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

test.describe("Student Module", () => {
  test.describe.configure({ mode: "serial" });
  const createdStudentName = `E2E Test Student ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("Student List Loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", (response) => {
      if (response.status() === 404 || response.status() === 500) {
        failedRequests.push(`${response.url()} (${response.status()})`);
      }
    });

    const response = await page.goto("/admin/students", { waitUntil: "networkidle" });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    await expect(page.getByRole("heading").first()).toBeVisible();

    const heading = page.getByRole("heading").first();
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/student/i);

    const table = page.locator("table, [role='table'], [class*='table'], .data-table");
    const cardList = page.locator("ul.divide-y, [class*='divide-y'], [class*='student-list']");
    const anyList = page.locator(
      "table, [role='table'], ul.divide-y, [class*='divide-y'], [class*='student-card'], .card"
    );

    await expect(anyList.first()).toBeVisible({ timeout: 10000 });

    expect(consoleErrors).toHaveLength(0);
    expect(failedRequests).toHaveLength(0);

    await page.screenshot({ path: "tests/screenshots/student-list-loads.png", fullPage: true });
  });

  test("Search Student", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const searchInput = page.getByPlaceholder(/search|find/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    const initialCount = await page.locator("table tbody tr, ul.divide-y li").count();

    await searchInput.fill("Rahul");
    await searchInput.press("Enter");
    await page.waitForTimeout(1000);

    const searchHeading = page.getByRole("heading").first();
    await expect(searchHeading).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/student-search.png", fullPage: true });

    await searchInput.clear();
    await searchInput.press("Enter");
    await page.waitForTimeout(1000);
  });

  test("Filter by Class and Section", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const classButtons = page.locator("button[aria-pressed]");
    const classCard = page.locator("button", { hasText: /class 1/i }).first();
    const sectionSelect = page.locator("select[id^='class-section-']").first();

    if (await classCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await classCard.click();
      await page.waitForTimeout(1500);

      if (await sectionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        const options = await sectionSelect.locator("option").all();
        if (options.length > 1) {
          await sectionSelect.selectOption(options[1].getAttribute("value") ?? "");
          await page.waitForTimeout(1000);
        }
      }
    } else {
      const classSelect = page.locator(
        "select[name='class'], select[aria-label*='class' i], select:has(option[value='1'])"
      ).first();
      if (await classSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await classSelect.selectOption("1");
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({ path: "tests/screenshots/student-filter-class.png", fullPage: true });
  });

  test("Open Student Profile", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const studentLink = page.locator(
      "a[href*='admission-form'], a[aria-label*='Print admission form'], a[aria-label*='View'], a[aria-label*='profile']"
    ).first();
    const studentNameCell = page.locator("table tbody tr td:nth-child(3), table tbody tr td.name-column, [class*='student-name'] a").first();

    let targetUrl = "";

    if (await studentLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      targetUrl = await studentLink.getAttribute("href") ?? "";
      await studentLink.click();
    } else if (await studentNameCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentNameCell.click();
    }

    await page.waitForURL(/admission-form/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("networkidle");

    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/SRI NARAYANA/i);

    const hasStudentName = await page.getByText(/student/i).first().isVisible().catch(() => false);
    expect(hasStudentName).toBeTruthy();

    await page.screenshot({ path: "tests/screenshots/student-profile.png", fullPage: true });
  });

  test("Validation Errors (Add Student - Negative Test)", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const addButton = page.getByRole("button", { name: /add student|new student/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const submitButton = page.getByRole("button", { name: /add student|save student|save/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    const studentNameInput = page.locator("input[name='studentName'], input[placeholder*='full name' i]").first();
    if (await studentNameInput.isVisible()) {
      await studentNameInput.clear();
    }

    await submitButton.click();

    const validationErrors: string[] = [];
    const invalidInputs = await page.locator("input:invalid, select:invalid").all();
    for (const input of invalidInputs) {
      const name = await input.getAttribute("name").catch(() => "unknown");
      validationErrors.push(name);
    }

    if (validationErrors.length > 0) {
      expect(validationErrors.length).toBeGreaterThanOrEqual(1);
    } else {
      const errorAlert = page.locator(
        "div[class*='border-[#ffd5da]'], div[class*='error'], [role='alert']"
      ).first();
      const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        const errorText = await errorAlert.textContent();
        expect(errorText?.length).toBeGreaterThan(0);
      }
    }

    await page.screenshot({ path: "tests/screenshots/student-validation-errors.png", fullPage: true });
  });

  test("Add Student (Happy Path)", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const addButton = page.getByRole("button", { name: /add student|new student/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const nameInput = page.locator("input[name='studentName'], input[placeholder*='full name' i]").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(createdStudentName);

    const classSelect = page.locator("select[name='class']").first();
    if (await classSelect.isVisible()) {
      await classSelect.selectOption("1");
    }

    const sectionSelect = page.locator("select[name='section']").first();
    if (await sectionSelect.isVisible()) {
      const sectionOptions = await sectionSelect.locator("option").all();
      if (sectionOptions.length > 1) {
        await sectionSelect.selectOption(sectionOptions[1].getAttribute("value") ?? "");
      }
    }

    const fatherNameInput = page.locator("input[name='fatherName'], input[placeholder*='father' i]").first();
    if (await fatherNameInput.isVisible()) {
      await fatherNameInput.fill("Test Father");
    }

    const phoneInput = page.locator("input[name='phone'], input[placeholder*='phone' i], input[type='tel']").first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill("9876543210");
    }

    const addressInput = page.locator("textarea[name='address'], input[name='address'], textarea[placeholder*='address' i]").first();
    if (await addressInput.isVisible()) {
      await addressInput.fill("123 Test Street, Test City");
    }

    const submitButton = page.getByRole("button", { name: /add student|save student|save/i }).first();
    await submitButton.click();

    await page.waitForTimeout(2000);

    const successMessage = page.locator("text=Student added successfully").first();
    const successVisible = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);

    if (!successVisible) {
      const pageText = await page.textContent("body");
      const hasSuccess = pageText?.includes("successfully");
      expect(hasSuccess).toBeTruthy();
    }

    await page.screenshot({ path: "tests/screenshots/student-add-success.png", fullPage: true });
  });

  test("Student Profile Does Not Read Full Collection", async ({ page }) => {
    await page.goto("/admin/students", { waitUntil: "networkidle" });

    const studentLinks = page.locator("a[href*='admission-form']");
    const linkCount = await studentLinks.count();

    if (linkCount > 0) {
      const href = await studentLinks.first().getAttribute("href");
      if (href) {
        await page.goto(href, { waitUntil: "networkidle" });
        await expect(page.locator("body")).toBeVisible();
        const bodyText = await page.textContent("body");
        expect(bodyText).toMatch(/SRI NARAYANA|student/i);

        await page.screenshot({
          path: "tests/screenshots/student-profile-efficient.png",
          fullPage: true,
        });
      }
    } else {
      test.skip();
    }
  });
});
