import type { Holiday } from "../types/models";

/** A holiday counts as active unless it was explicitly cancelled. */
export function isHolidayActive(holiday: Holiday): boolean {
  return holiday.isActive !== false;
}

export function isManagementDeclaredHoliday(holiday: Holiday): boolean {
  return holiday.type === "management_declared";
}

/**
 * Whether a holiday applies to the given branch. Holidays without branch
 * scoping (regular school holidays) apply everywhere.
 */
export function holidayAppliesToBranch(holiday: Holiday, branchId?: string): boolean {
  if (holiday.appliesToAllBranches !== false) return true;
  if (!holiday.branchId) return true;
  return Boolean(branchId) && holiday.branchId === branchId;
}

/** Active holidays only, optionally scoped to a branch. */
export function filterActiveHolidays(holidays: Holiday[], branchId?: string): Holiday[] {
  return holidays.filter((holiday) => isHolidayActive(holiday) && holidayAppliesToBranch(holiday, branchId));
}

/** Find the active holiday declared for a date (YYYY-MM-DD), if any. */
export function findHolidayForDate(holidays: Holiday[], date: string, branchId?: string): Holiday | undefined {
  const dateKey = date.slice(0, 10);
  const matches = filterActiveHolidays(holidays, branchId).filter((holiday) => holiday.date.slice(0, 10) === dateKey);
  // Prefer management-declared holidays so their reason is surfaced to teachers.
  return matches.find(isManagementDeclaredHoliday) ?? matches[0];
}

export function isHolidayDate(holidays: Holiday[], date: string, branchId?: string): boolean {
  return Boolean(findHolidayForDate(holidays, date, branchId));
}

/** Message shown to teachers when attendance is blocked by a declared holiday. */
export function managementHolidayMessage(holiday: Holiday): string {
  const reason = holiday.reason?.trim() || holiday.title;
  return `Management has declared holiday today. Reason: ${reason}. Attendance is not required today.`;
}

/** Formatted "date (reason)" list for reports and Excel exports. */
export function formatManagementHolidayInfo(holidays: Holiday[]): string {
  return holidays
    .filter((holiday) => isManagementDeclaredHoliday(holiday) && isHolidayActive(holiday))
    .map((holiday) => `${holiday.date.slice(0, 10)} (${holiday.reason?.trim() || holiday.title})`)
    .join(", ");
}
