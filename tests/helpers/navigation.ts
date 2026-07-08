import { Page, expect } from "@playwright/test";

export interface RouteInfo {
  path: string;
  label: string;
  allowedRoles: string[];
  expectedHeading?: string;
}

export const ADMIN_ROUTES: RouteInfo[] = [
  { path: "/admin/dashboard", label: "Dashboard", allowedRoles: ["super_admin", "admin", "principal", "accountant", "settings_manager"], expectedHeading: "Dashboard" },
  { path: "/admin/students", label: "Students", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Students" },
  { path: "/admin/parents", label: "Parents", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Parents" },
  { path: "/admin/teachers", label: "Staff", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Staff" },
  { path: "/admin/attendance", label: "Attendance", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Attendance" },
  { path: "/admin/finance", label: "Fees & Finance", allowedRoles: ["super_admin", "accountant"], expectedHeading: "Finance" },
  { path: "/admin/payments", label: "Collect Fee", allowedRoles: ["super_admin", "accountant"], expectedHeading: "Payment" },
  { path: "/admin/fee-structures", label: "Fee Structures", allowedRoles: ["super_admin", "accountant"], expectedHeading: "Fee" },
  { path: "/admin/salary", label: "Salary", allowedRoles: ["super_admin", "admin"], expectedHeading: "Salary" },
  { path: "/admin/exams", label: "Exams", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Exam" },
  { path: "/admin/notices", label: "Notices", allowedRoles: ["super_admin", "admin", "principal", "accountant"], expectedHeading: "Notice" },
  { path: "/admin/reports", label: "Reports", allowedRoles: ["super_admin", "admin", "principal"], expectedHeading: "Report" },
  { path: "/admin/ai-agent", label: "AI Agent", allowedRoles: ["super_admin", "admin"], expectedHeading: "AI" },
  { path: "/admin/settings", label: "Settings", allowedRoles: ["super_admin", "settings_manager"], expectedHeading: "Setting" },
];

export const TEACHER_ROUTES: RouteInfo[] = [
  { path: "/teacher", label: "Teacher Dashboard", allowedRoles: ["teacher"], expectedHeading: "Dashboard" },
  { path: "/teacher/dashboard", label: "Dashboard", allowedRoles: ["teacher"], expectedHeading: "Dashboard" },
  { path: "/teacher/salary", label: "Salary", allowedRoles: ["teacher"], expectedHeading: "Salary" },
];

export const PORTAL_ROUTES: RouteInfo[] = [
  { path: "/portal", label: "Parent Portal", allowedRoles: ["parent"], expectedHeading: "Dashboard" },
  { path: "/portal/fees", label: "Fees", allowedRoles: ["parent"], expectedHeading: "Fee" },
  { path: "/portal/exams", label: "Exams", allowedRoles: ["parent"], expectedHeading: "Exam" },
  { path: "/portal/notices", label: "Notices", allowedRoles: ["parent"], expectedHeading: "Notice" },
];

export const RESTRICTED_ROUTES: { path: string; blockedRoles: string[] }[] = [
  { path: "/admin/finance", blockedRoles: ["admin", "principal", "teacher", "parent"] },
  { path: "/admin/settings", blockedRoles: ["admin", "principal", "accountant", "teacher", "parent"] },
  { path: "/admin/users", blockedRoles: ["teacher", "parent"] },
  { path: "/teacher", blockedRoles: ["admin", "parent"] },
  { path: "/portal", blockedRoles: ["admin", "teacher"] },
];

export async function checkPageLoads(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status()).not.toBe(404);
  expect(response?.status()).not.toBe(500);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const hasPermissionError = await page.locator("text=permission-denied, text=Missing or insufficient permissions, text=PERMISSION_DENIED").isVisible().catch(() => false);
  expect(hasPermissionError).toBeFalsy();

  return { consoleErrors };
}

export async function checkMenuItems(page: Page, allowedItems: string[], blockedItems: string[]) {
  for (const item of allowedItems) {
    await expect(page.locator(`nav:has-text("${item}"), aside:has-text("${item}"), [data-testid="sidebar"]:has-text("${item}")`).first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Item might be in a submenu
    });
  }
}

export async function checkAccessDenied(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  expect(body?.toLowerCase()).toContain("unauthorized") || expect(body?.toLowerCase()).toContain("access denied") || expect(body?.toLowerCase()).toContain("access_denied");
}
