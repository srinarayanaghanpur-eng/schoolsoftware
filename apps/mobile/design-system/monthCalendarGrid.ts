/**
 * Pure Monday-first month-grid logic for MonthCalendar.
 *
 * Local-date only: `new Date(year, month - 1, 1)` and
 * `new Date(year, month, 0)` are constructed from calendar fields in the
 * device's local zone and never pass through a UTC/IST string conversion,
 * so the weekday of the 1st cannot shift. `getDay()` here reads the local
 * weekday, which is exactly what a Monday-first wall calendar needs.
 */

/** Days in a 1-12 month (local calendar, no timezone conversion). */
export function daysInMonthLocal(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Monday-first leading-blank count: Mon = 0 … Sun = 6. */
export function getMondayFirstOffset(year: number, month: number): number {
  const first = new Date(year, month - 1, 1);
  return (first.getDay() + 6) % 7;
}

export type CalendarCell = { day: number } | null;

/** `offset` null blanks, then days 1..daysInMonth. */
export function getMonthCalendarCells(year: number, month: number): CalendarCell[] {
  const offset = getMondayFirstOffset(year, month);
  const days = daysInMonthLocal(year, month);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push({ day: d });
  return cells;
}

/** Monday-first column 0..6 (0 = Mon … 6 = Sun) for a day-of-month. */
export function getWeekdayColumn(year: number, month: number, day: number): number {
  return (getMondayFirstOffset(year, month) + day - 1) % 7;
}
