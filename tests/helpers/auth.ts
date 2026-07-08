import { Page } from "@playwright/test";

export interface TestUser {
  employeeId: string;
  password: string;
  role: string;
  name: string;
  email: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  super_admin: {
    employeeId: "SUPER001",
    password: "Test@123",
    role: "super_admin",
    name: "Test Super Admin",
    email: "super001@test.school",
  },
  admin: {
    employeeId: "ADMIN001",
    password: "Test@123",
    role: "admin",
    name: "Test Admin",
    email: "admin001@test.school",
  },
  principal: {
    employeeId: "PRIN001",
    password: "Test@123",
    role: "principal",
    name: "Test Principal",
    email: "prin001@test.school",
  },
  accountant: {
    employeeId: "ACCT001",
    password: "Test@123",
    role: "accountant",
    name: "Test Accountant",
    email: "acct001@test.school",
  },
  teacher: {
    employeeId: "TEACH001",
    password: "Test@123",
    role: "teacher",
    name: "Test Teacher",
    email: "teach001@test.school",
  },
  parent: {
    employeeId: "PARENT001",
    password: "Test@123",
    role: "parent",
    name: "Test Parent",
    email: "parent001@test.school",
  },
  student: {
    employeeId: "STU001",
    password: "Test@123",
    role: "student",
    name: "Test Student",
    email: "stu001@test.school",
  },
  settings_manager: {
    employeeId: "SETTINGS001",
    password: "Test@123",
    role: "settings_manager",
    name: "Test Settings Manager",
    email: "settings001@test.school",
  },
};

export async function loginAs(page: Page, role: string) {
  const user = TEST_USERS[role];
  if (!user) throw new Error(`Unknown role: ${role}`);

  await page.goto("/login");
  await page.waitForSelector('input[type="text"], input[name="employeeId"], input[placeholder*="employee" i], input[placeholder*="ID" i]', { timeout: 10000 });

  const employeeInput = page.locator('input[type="text"], input[name="employeeId"], input[placeholder*="employee" i], input[placeholder*="ID" i]').first();
  await employeeInput.fill(user.employeeId);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(user.password);

  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Sign in")').first().click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

export async function logout(page: Page) {
  const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("Sign out")').first();
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click();
  }
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
}
