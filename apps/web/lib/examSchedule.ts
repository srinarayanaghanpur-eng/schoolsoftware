export type ExamWindowState = "not_started" | "open" | "closed";

const IST_OFFSET = "+05:30";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/**
 * Schedule values come from <input type="datetime-local">, so they carry no
 * timezone. The school operates in IST: treat naive values as +05:30 instead of
 * letting the server (UTC) shift them by 5.5 hours.
 */
export function parseExamSchedule(value: string, endOfDay = false): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (DATE_ONLY.test(trimmed)) return Date.parse(`${trimmed}T${endOfDay ? "23:59:59" : "00:00:00"}${IST_OFFSET}`);
  if (LOCAL_DATETIME.test(trimmed)) return Date.parse(`${trimmed}${IST_OFFSET}`);
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function examWindowState(openAt: string, closeAt: string, now = Date.now()): ExamWindowState {
  const opens = parseExamSchedule(openAt);
  const closes = parseExamSchedule(closeAt, true);
  if (opens !== null && now < opens) return "not_started";
  if (closes !== null && now > closes) return "closed";
  return "open";
}
