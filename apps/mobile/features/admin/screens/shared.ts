import type { AdminTeacher, StaffDriver, StaffOffice } from "../api";

export const STAFF_FILTERS = ["All", "Active", "Inactive"];

export type StaffSection = {
  title: string;
  kind: "teacher" | "driver" | "office";
  data: (AdminTeacher | StaffDriver | StaffOffice)[];
};

export const SUPPORT_ROLES = new Set(["accountant", "settings_manager", "support", "support_staff"]);
export const ADMIN_OFFICE_ROLES = new Set(["super_admin", "admin", "principal", "administrator", "office_admin"]);

export function staffField(member: object, key: string) {
  const value = (member as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function normalizeStaffRole(role?: string) {
  return (role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function staffCategoryForOffice(role?: string): "support" | "office" | "other" {
  const key = normalizeStaffRole(role);
  if (!key) return "other";
  if (SUPPORT_ROLES.has(key) || /(support|assistant|librarian|clerk|attender|nurse|warden|cook|security)/.test(key)) {
    return "support";
  }
  if (ADMIN_OFFICE_ROLES.has(key) || /(admin|principal|office|manager)/.test(key)) {
    return "office";
  }
  return "other";
}

export function matchesStaffFilter(member: { status?: string }, filter: string) {
  if (filter === "All") return true;
  const status = (member.status ?? "active").toLowerCase();
  return filter === "Active" ? status === "active" : status !== "active";
}

export function matchesStaffQuery(member: AdminTeacher | StaffDriver | StaffOffice, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    "fullName", "name", "displayName", "employeeId", "subject", "role", "email",
    "phone", "mobile", "vehicleNo", "vehicle", "licenseNo"
  ].some((key) => staffField(member, key).toLowerCase().includes(q));
}
