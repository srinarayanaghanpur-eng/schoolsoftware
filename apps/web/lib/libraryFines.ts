export const LIBRARY_FINE_PER_DAY = 5;

function toDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function overdueDays(dueDate: string, onDate: string | Date = new Date()) {
  const due = toDate(dueDate);
  const today = toDate(onDate);
  if (!due || !today) return 0;
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export function libraryFine(dueDate: string, onDate: string | Date = new Date(), perDay = LIBRARY_FINE_PER_DAY) {
  return overdueDays(dueDate, onDate) * perDay;
}

export function defaultDueDate(days = 14) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
