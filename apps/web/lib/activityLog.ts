import type { DecodedIdToken } from "firebase-admin/auth";
import type { Role } from "@sri-narayana/shared";
import { writeAuditLog } from "@/lib/auditLog";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ACTION_WORDS = new Set([
  "bulk-delete", "bulk-upload", "approve", "reject", "cancel", "confirm", "send",
  "resend", "retry", "reset-password", "erase-data", "restore-data", "promote",
  "generate", "upload", "mark", "assign", "verify", "check", "test", "seed",
  "sync", "export", "import", "download", "transfer", "close", "reopen", "pay"
]);

// Only document-generation GETs are logged; ordinary list GETs are not.
const DOCUMENT_GET_PATTERN = /\/(receipts?|hall-ticket|report-card|salary-slip|salary\/slip|export|download)(\/|$)|\/(docx|pdf|print)$/i;

/** Firestore writes are best-effort — an activity log failure must never break the request. */
function warn(message: string, error: unknown): void {
  console.error(`[activityLog] ${message}`, error);
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

function deviceInfo(req: Request): string | undefined {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 300) : undefined;
}

/**
 * Derive a compact action name from the request method and URL, e.g.
 * `POST /api/admin/students` → `students.create`,
 * `DELETE /api/admin/certificates/abc` → `certificates.delete`.
 * Returns null for ordinary GETs (only document-generation GETs are recorded).
 */
export function describeRequestActivity(req: Request): {
  action: string;
  entityType: string;
  entityId: string;
} | null {
  const method = req.method.toUpperCase();
  const pathname = new URL(req.url).pathname;
  const segments = pathname
    .replace(/^\/api\/admin\/?/, "")
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);

  const moduleName = (segments[0] ?? "api").replace(/-/g, "_");
  const last = segments[segments.length - 1] ?? "";
  const second = segments[1] ?? "";
  const actionWord = ACTION_WORDS.has(last) ? last : ACTION_WORDS.has(second) ? second : "";
  const entityId = method !== "GET" && second && !ACTION_WORDS.has(second) ? second : "";

  let verb = "";
  if (MUTATION_METHODS.has(method)) {
    verb = method === "POST" ? "create" : method === "PUT" || method === "PATCH" ? "update" : "delete";
  } else if (method === "GET" && DOCUMENT_GET_PATTERN.test(pathname)) {
    verb = "generate";
  }
  if (!verb) return null;

  if (actionWord) {
    verb = actionWord.replace(/-/g, "_");
    if (verb === "bulk_delete" || verb === "bulk_upload") {
      verb = verb === "bulk_delete" ? "bulk_delete" : "bulk_create";
    }
    if (verb === "erase_data") verb = "erase";
    if (verb === "restore_data") verb = "restore";
    if (verb === "reset_password") verb = "reset_password";
  }

  return { action: `${moduleName}.${verb}`, entityType: moduleName, entityId };
}

// A handler may run more than one permission check (requirePermission plus
// checkPermissionWithMessage); log the request only once.
const loggedRequests = new WeakSet<Request>();

/** Record an authenticated API mutation in the global audit trail. */
export async function recordRequestActivity(
  req: Request,
  token: DecodedIdToken,
  role: Role | undefined
): Promise<void> {
  try {
    if (loggedRequests.has(req)) return;
    const activity = describeRequestActivity(req);
    if (!activity) return;
    loggedRequests.add(req);
    const pathname = new URL(req.url).pathname;
    await writeAuditLog({
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      actorId: token.uid,
      actorRole: role ?? (typeof token.role === "string" ? token.role : ""),
      reason: `${req.method.toUpperCase()} ${pathname}`,
      deviceInfo: deviceInfo(req),
      ipAddress: clientIp(req),
      source: "api"
    });
  } catch (error) {
    warn("request activity write failed", error);
  }
}

/** Record a sign-in / sign-out event for the global activity log. */
export async function recordSessionActivity(
  req: Request,
  token: DecodedIdToken,
  action: "user.login" | "user.logout",
  role: Role | undefined,
  reason?: string
): Promise<void> {
  try {
    await writeAuditLog({
      action,
      entityType: "user",
      entityId: token.uid,
      actorId: token.uid,
      actorRole: role ?? (typeof token.role === "string" ? token.role : ""),
      reason: reason ?? (action === "user.login" ? "Signed in" : "Signed out"),
      deviceInfo: deviceInfo(req),
      ipAddress: clientIp(req),
      source: "auth"
    });
  } catch (error) {
    warn(`${action} activity write failed`, error);
  }
}
