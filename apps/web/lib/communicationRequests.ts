import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

// Unified "communication request" model surfaced by the admin Notifications
// page. It merges three underlying collections that each have their own schema
// and status vocabulary into one normalized shape with a common status set.

export type RequestType = "password_reset" | "leave" | "attendance_edit";
export type NormalizedStatus = "pending" | "approved" | "rejected" | "log";
export type FilterStatus = NormalizedStatus | "archived" | "all";
export type FilterType = RequestType | "all";

export type NormalizedRequest = {
  id: string;
  type: RequestType;
  name: string;
  roleOrClass: string;
  createdAt: string; // ISO
  status: NormalizedStatus;
  message: string;
  archived: boolean;
  deletedAt: string | null;
  // Extra fields the UI needs for actions (e.g. password reset targets a teacher).
  teacherId?: string;
  userId?: string;
  userRole?: string;
  targetType?: string;
  loginId?: string;
  employeeId?: string;
};

type SourceConfig = {
  type: RequestType;
  collection: string;
  dateField: string;
  // Whether this source participates in pending/approved/rejected status tabs.
  hasStatus: boolean;
  // Map a normalized status → the value stored in this collection.
  nativeStatus?: Partial<Record<Exclude<NormalizedStatus, "log">, string>>;
  // Which admin actions are allowed against this source.
  allowApprove: boolean;
  allowReject: boolean;
  // Audit records must never be hard-deleted; only soft-hidden/archived.
  auditProtected: boolean;
};

export const REQUEST_SOURCES: Record<RequestType, SourceConfig> = {
  password_reset: {
    type: "password_reset",
    collection: "password_reset_requests",
    dateField: "requestedAt",
    hasStatus: true,
    nativeStatus: { pending: "open", approved: "resolved", rejected: "rejected" },
    allowApprove: false, // password "approval" happens via the reset-password modal
    allowReject: true,
    auditProtected: false
  },
  leave: {
    type: "leave",
    collection: "leave_requests",
    dateField: "requestedAt",
    hasStatus: true,
    nativeStatus: { pending: "pending", approved: "approved", rejected: "rejected" },
    allowApprove: true,
    allowReject: true,
    auditProtected: false
  },
  attendance_edit: {
    type: "attendance_edit",
    collection: "attendance_edit_audit_logs",
    dateField: "editedAt",
    hasStatus: false,
    allowApprove: false,
    allowReject: false,
    auditProtected: true
  }
};

export const ALL_TYPES: RequestType[] = ["password_reset", "leave", "attendance_edit"];

export function sourceForType(type: string): SourceConfig | null {
  return (REQUEST_SOURCES as Record<string, SourceConfig>)[type] ?? null;
}

/** Normalized status → native status value stored in the given source. */
export function nativeStatusFor(source: SourceConfig, status: NormalizedStatus): string | null {
  if (!source.hasStatus || status === "log") return null;
  return source.nativeStatus?.[status] ?? null;
}

/** Native stored status → normalized status. */
function normalizeStatus(source: SourceConfig, raw: unknown): NormalizedStatus {
  if (!source.hasStatus) return "log";
  const value = String(raw ?? "").toLowerCase();
  if (value === "open" || value === "pending") return "pending";
  if (value === "resolved" || value === "approved") return "approved";
  if (value === "rejected" || value === "denied") return "rejected";
  return "pending";
}

function asIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

/** Convert a raw Firestore doc into the unified request shape. */
export function normalizeRequest(source: SourceConfig, doc: QueryDocumentSnapshot): NormalizedRequest {
  const data = doc.data() as Record<string, unknown>;
  const createdAt = asIso(data[source.dateField] ?? data.createdAt);

  let name = "";
  let roleOrClass = "";
  let message = "";

  if (source.type === "password_reset") {
    name = String(data.teacherName || data.userName || data.loginId || "Unknown");
    roleOrClass = String(data.employeeId || data.userRole || "Account");
    message = String(data.adminNote || "Password reset requested");
  } else if (source.type === "leave") {
    name = String(data.teacherName || "Unknown");
    roleOrClass = String(data.employeeId || "Teacher");
    const range = data.startDate && data.endDate ? `${data.startDate} → ${data.endDate}: ` : "";
    message = `${range}${String(data.reason || "")}`.trim();
  } else {
    name = String(data.teacherId || "System");
    roleOrClass = String(data.date || "");
    const prev = data.previousStatus ? `${data.previousStatus} → ` : "";
    message = `${prev}${String(data.newStatus || "")} · ${String(data.reason || "")}`.trim();
  }

  return {
    id: doc.id,
    type: source.type,
    name,
    roleOrClass,
    createdAt,
    status: normalizeStatus(source, data.status),
    message,
    archived: data.archived === true,
    deletedAt: data.deletedAt ? asIso(data.deletedAt) : null,
    teacherId: data.teacherId ? String(data.teacherId) : undefined,
    userId: data.userId ? String(data.userId) : undefined,
    userRole: data.userRole ? String(data.userRole) : undefined,
    targetType: data.targetType ? String(data.targetType) : undefined,
    loginId: data.loginId ? String(data.loginId) : undefined,
    employeeId: data.employeeId ? String(data.employeeId) : undefined
  };
}

/** Lowercased haystack for in-memory search over a normalized request. */
export function searchHaystack(request: NormalizedRequest): string {
  return [request.name, request.roleOrClass, request.message, request.teacherId, request.userId, request.userRole, request.loginId, request.employeeId, request.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
