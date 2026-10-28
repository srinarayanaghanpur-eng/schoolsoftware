import { FieldValue } from "firebase-admin/firestore";
import { noticeCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, requireAdminOrPrincipal, requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getAllParentUids, getParentUidsForClass, sendPushToUsers } from "@/lib/push/sendPush";

const COLLECTION = "notices";

// GET /api/admin/notices — list notices (newest first).
export async function GET(req: Request) {
  const token = await requirePermission(req, "communication.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snapshot = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(100).get();
  const notices = snapshot.docs.map((doc) => serializeDoc(doc));
  return json({ ok: true, notices });
}

// POST /api/admin/notices — create a notice/circular.
export async function POST(req: Request) {
  const token = await requireAdminOrPrincipal(req);
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const permitted = await requirePermission(req, "communication.create");
  if (!permitted) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `notice-create:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 32 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = noticeCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const externalChannels = parsed.channels.filter((c) => c !== "app");
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      createdBy: token.uid,
      // delivery bookkeeping for the future SMS/WhatsApp/email integration
      deliveredApp: parsed.channels.includes("app"),
      pendingChannels: externalChannels,
      createdAt: now,
      updatedAt: now
    });
    // Push IS the app channel — skip when the notice doesn't target it.
    void notifyNoticeAudience(parsed).catch(() => undefined);
    return json({ ok: true, id: ref.id, pendingChannels: externalChannels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create notice";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

const STAFF_ROLES = new Set(["teacher", "teachers", "admin", "principal", "accountant", "settings_manager", "super_admin"]);

const NOTICE_ROUTE_BY_ROLE: Record<string, string> = {
  teacher: "/teacher/inbox",
  teachers: "/teacher/inbox",
  admin: "/admin/notices",
  principal: "/principal/notices",
  accountant: "/accountant/notices",
  settings_manager: "/admin/notices",
  super_admin: "/admin/notices"
};

const MAX_STAFF_NOTICE_USERS = 500;

async function getStaffNoticeTargets(): Promise<Array<{ route: string; uids: string[] }>> {
  const snapshot = await adminDb().collection("users").limit(MAX_STAFF_NOTICE_USERS).get();
  const byRoute = new Map<string, string[]>();
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const role = String(data.role ?? "").toLowerCase();
    if (!STAFF_ROLES.has(role)) continue;
    if (String(data.status ?? "").toLowerCase() === "inactive") continue;
    const route = NOTICE_ROUTE_BY_ROLE[role] ?? "/teacher/inbox";
    const uids = byRoute.get(route) ?? [];
    uids.push(doc.id);
    byRoute.set(route, uids);
  }
  return [...byRoute].map(([route, uids]) => ({ route, uids }));
}

async function notifyNoticeAudience(input: {
  channels: string[];
  audienceRoles?: string[];
  audienceClasses?: string[];
  title: string;
  body: string;
}): Promise<void> {
  if (!input.channels.includes("app")) return;
  const roles = (input.audienceRoles ?? []).map((r) => String(r).toLowerCase());
  const wantsParents = roles.length === 0 || roles.includes("parent") || roles.includes("parents");
  const wantsStaff = roles.length === 0 || roles.some((r) => STAFF_ROLES.has(r));

  const sends: Promise<unknown>[] = [];

  if (wantsParents) {
    const parentUids = new Set<string>();
    const classes = input.audienceClasses ?? [];
    if (classes.length > 0) {
      for (const className of classes.slice(0, 20)) {
        for (const uid of await getParentUidsForClass(String(className))) parentUids.add(uid);
      }
    } else {
      for (const uid of await getAllParentUids()) parentUids.add(uid);
    }
    if (parentUids.size > 0) {
      sends.push(sendPushToUsers([...parentUids], {
        category: "notices",
        title: input.title,
        body: input.body.slice(0, 180),
        route: "/parent/messages"
      }));
    }
  }

  if (wantsStaff) {
    for (const target of await getStaffNoticeTargets()) {
      sends.push(sendPushToUsers(target.uids, {
        category: "notices",
        title: input.title,
        body: input.body.slice(0, 180),
        route: target.route
      }));
    }
  }

  await Promise.all(sends);
}

