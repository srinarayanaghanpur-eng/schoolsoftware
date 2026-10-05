/**
 * Server-text sanitizer (crash fix).
 *
 * Firestore Timestamps cross the API as plain {_seconds, _nanoseconds}
 * objects. If one ever lands where a label/title/body is rendered, React
 * throws "Objects are not valid as a React child" (minified error #31) and
 * the whole screen dies behind the error boundary. Every string that comes
 * from the server must pass through asText before render.
 *
 * Dependency-free so it runs under plain node:test.
 */

export function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/** Firestore Timestamp-shaped payloads ({_seconds/_nanoseconds}) to ISO date. */export function asDateString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (
    !!value &&
    typeof value === "object" &&
    typeof (value as { _seconds?: unknown })._seconds === "number"
  ) {
    const seconds = (value as { _seconds: number; _nanoseconds?: unknown })._seconds;
    const nanos =
      typeof (value as { _nanoseconds?: unknown })._nanoseconds === "number"
        ? ((value as { _nanoseconds: number })._nanoseconds as number)
        : 0;
    const date = new Date(seconds * 1000 + Math.floor(nanos / 1000000));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return fallback;
}

// Internal staff/parent addresses live under this domain (mirrors
// INTERNAL_TEACHER_EMAIL_DOMAIN in shared — kept literal because the shared
// barrel pulls node:crypto, which cannot bundle on mobile).
const INTERNAL_EMAIL_DOMAIN = "srinarayana.local";

/**
 * Contact line for profile screens. Internal @srinarayana.local addresses
 * are login machinery, not something a user should ever see — show the
 * login ID instead.
 */
export function displayLoginContact(
  profile: { email?: unknown; employeeId?: unknown } | null | undefined
): string {
  const email = typeof profile?.email === "string" ? profile.email.trim() : "";
  if (email && !email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)) return email;
  const employeeId = typeof profile?.employeeId === "string" ? profile.employeeId.trim() : "";
  return employeeId;
}
