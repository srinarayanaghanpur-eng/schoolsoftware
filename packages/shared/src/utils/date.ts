export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function nowIso() {
  return new Date().toISOString();
}

export function toDateKey(date: Date | string, timezone = DEFAULT_TIMEZONE) {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function toMonthKey(date: Date | string, timezone = DEFAULT_TIMEZONE) {
  return toDateKey(date, timezone).slice(0, 7);
}

export function getYear(date: Date | string, timezone = DEFAULT_TIMEZONE) {
  return Number(toDateKey(date, timezone).slice(0, 4));
}

export function getTimePartsInZone(date: Date | string, timezone = DEFAULT_TIMEZONE) {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(value);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  };
}

export function minutesFromClock(clock: string) {
  const [rawHour, rawMinute] = clock.split(":");
  return Number(rawHour) * 60 + Number(rawMinute);
}

export function daysInMonth(year: number, monthNumber: number) {
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}
