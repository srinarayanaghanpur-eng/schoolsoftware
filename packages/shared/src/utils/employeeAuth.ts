export const INTERNAL_TEACHER_EMAIL_DOMAIN = "srinarayana.local";

export function normalizeEmployeeId(employeeId: string) {
  return employeeId.trim().toUpperCase();
}

export function employeeIdToInternalEmail(employeeId: string) {
  return `${normalizeEmployeeId(employeeId).toLowerCase()}@${INTERNAL_TEACHER_EMAIL_DOMAIN}`;
}
