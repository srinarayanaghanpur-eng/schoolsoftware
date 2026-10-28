import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { json, requireRole } from "@/lib/apiUtils";

export const runtime = "nodejs";

const MAX_SCAN = 800;

type RawEntry = Record<string, unknown> & { id?: string };

type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  description: string;
  ipAddress: string;
  deviceInfo: string;
  source: string;
  createdAt: string;
};

function toIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "object" && value !== null) {
    const maybe = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof maybe.toDate === "function") return maybe.toDate().toISOString();
    const seconds = typeof maybe.seconds === "number" ? maybe.seconds : maybe._seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  }
  return "";
}

function categoryOf(action: string): string {
  const value = action.toLowerCase();
  if (/(login|logout|sign_in|sign_out)/.test(value)) return "session";
  if (/(generate|export|download|print)/.test(value)) return "generate";
  if (/(delete|erase|remove)/.test(value)) return "delete";
  if (/(create|upload|import|mark|issue|add)/.test(value)) return "create";
  if (/(update|edit|approve|reject|confirm|cancel|assign|transfer|promote|close|reopen|pay|send|resend|retry|reset_password|verify|restore)/.test(value)) return "update";
  return "other";
}

function normalizeAuditLog(doc: RawEntry): ActivityEntry {
  if (doc.type === "permission_update") {
    const change = String(doc.action ?? "");
    const role = String(doc.role ?? "");
    const permission = String(doc.permission ?? "");
    return {
      id: `api:${String(doc.id ?? "")}`,
      action: `roles.permission_${change}`,
      entityType: "roles",
      entityId: role,
      actorId: String(doc.changedBy ?? ""),
      actorName: String(doc.changedByName ?? ""),
      actorRole: "",
      description: `${permission} ${change} for ${role}`.trim(),
      ipAddress: "",
      deviceInfo: "",
      source: "rbac",
      createdAt: toIso(doc.createdAt)
    };
  }
  const action = String(doc.action ?? "");
  const entityType = String(doc.entityType ?? "");
  const entityId = String(doc.entityId ?? "");
  return {
    id: `api:${String(doc.id ?? "")}`,
    action,
    entityType,
    entityId,
    actorId: String(doc.actorId ?? ""),
    actorName: "",
    actorRole: String(doc.actorRole ?? ""),
    description: String(doc.reason ?? ""),
    ipAddress: String(doc.ipAddress ?? ""),
    deviceInfo: String(doc.deviceInfo ?? ""),
    source: String(doc.source ?? ""),
    createdAt: toIso(doc.createdAt)
  };
}

function normalizeAdminAuditLog(doc: RawEntry): ActivityEntry {
  const action = String(doc.action ?? "");
  const entityId = String(doc.teacherId ?? doc.requestId ?? doc.targetUserId ?? "");
  return {
    id: `legacy:${String(doc.id ?? "")}`,
    action,
    entityType: "admin",
    entityId,
    actorId: String(doc.createdBy ?? doc.performedBy ?? doc.adminId ?? ""),
    actorName: "",
    actorRole: "",
    description: String(doc.note ?? action.replace(/_/g, " ")),
    ipAddress: "",
    deviceInfo: "",
    source: "legacy",
    createdAt: toIso(doc.createdAt)
  };
}

/**
 * Routes that write a detailed audit entry also emit a generic request entry
 * (source "api") from their auth guard. Once the detailed entry exists, the
 * generic one is redundant — drop it when the same actor has a detailed entry
 * within 15 seconds.
 */
function dedupeGenericRequests(entries: ActivityEntry[]): ActivityEntry[] {
  const detailedByActor = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.source === "api") continue;
    const times = detailedByActor.get(entry.actorId);
    if (times) times.push(entry.createdAt);
    else detailedByActor.set(entry.actorId, [entry.createdAt]);
  }
  const windowMs = 15_000;
  return entries.filter((entry) => {
    if (entry.source !== "api") return true;
    const times = detailedByActor.get(entry.actorId);
    if (!times) return true;
    const at = Date.parse(entry.createdAt);
    return !times.some((iso) => Math.abs(Date.parse(iso) - at) <= windowMs);
  });
}

async function loadActorNames(ids: string[]): Promise<Map<string, { name: string; role: string }>> {
  const map = new Map<string, { name: string; role: string }>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    try {
      const snap = await adminDb()
        .collection("users")
        .where(FieldPath.documentId(), "in", chunk)
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const name =
          String(data.name ?? data.fullName ?? data.displayName ?? "").trim() ||
          String(data.email ?? "").trim() ||
          doc.id;
        map.set(doc.id, { name, role: String(data.role ?? "") });
      }
    } catch {
      // Names are a nicety — leave them blank if the lookup fails.
    }
  }
  return map;
}

export async function GET(req: Request) {
  // Restricted to the settings manager; requireRole always admits super_admin.
  const token = await requireRole(req, ["settings_manager"]);
  if (!token) {
    return json({ ok: false, error: "Access denied." }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const actorId = url.searchParams.get("actorId") ?? "";
  const role = url.searchParams.get("role") ?? "";
  const moduleFilter = url.searchParams.get("module") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const entries: ActivityEntry[] = [];
  let truncated = false;

  try {
    let query: FirebaseFirestore.Query = adminDb().collection("audit_logs");
    if (from) query = query.where("createdAt", ">=", from);
    if (to) query = query.where("createdAt", "<=", to);
    const snap = await query.orderBy("createdAt", "desc").limit(MAX_SCAN).get();
    truncated = snap.size >= MAX_SCAN;
    for (const doc of snap.docs) {
      entries.push(normalizeAuditLog({ id: doc.id, ...doc.data() }));
    }
  } catch {
    return json({ ok: false, error: "Unable to load activity logs." }, { status: 500 });
  }

  try {
    let legacyQuery: FirebaseFirestore.Query = adminDb().collection("admin_audit_logs");
    if (from) legacyQuery = legacyQuery.where("createdAt", ">=", from);
    if (to) legacyQuery = legacyQuery.where("createdAt", "<=", to);
    const legacySnap = await legacyQuery.orderBy("createdAt", "desc").limit(MAX_SCAN).get();
    truncated = truncated || legacySnap.size >= MAX_SCAN;
    for (const doc of legacySnap.docs) {
      entries.push(normalizeAdminAuditLog({ id: doc.id, ...doc.data() }));
    }
  } catch {
    // Legacy logs are optional; the main audit trail still loads.
  }

  const modules = [...new Set(entries.map((entry) => entry.entityType).filter(Boolean))].sort();

  const filtered = dedupeGenericRequests(entries)
    .filter((entry) => {
      if (!entry.createdAt) return false;
      if (from && entry.createdAt < from) return false;
      if (to && entry.createdAt > to) return false;
      if (actorId && entry.actorId !== actorId) return false;
      if (role && entry.actorRole !== role) return false;
      if (moduleFilter && entry.entityType !== moduleFilter) return false;
      if (type && categoryOf(entry.action) !== type) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const actors = await loadActorNames(filtered.map((entry) => entry.actorId));
  for (const entry of filtered) {
    const actor = actors.get(entry.actorId);
    entry.actorName = actor?.name || entry.actorId;
    if (!entry.actorRole && actor?.role) entry.actorRole = actor.role;
  }

  const searched = q
    ? filtered.filter((entry) =>
        [entry.action, entry.entityType, entry.entityId, entry.description, entry.actorName, entry.actorId, entry.ipAddress]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : filtered;

  const page = searched.slice(offset, offset + limit);

  return json({
    ok: true,
    entries: page,
    total: searched.length,
    offset,
    limit,
    hasMore: offset + page.length < searched.length,
    truncated,
    modules
  });
}
