import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { json, requireAdminOrPrincipal, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { sendPushToUsers } from "@/lib/push/sendPush";

const COLLECTION = "tasks";
const ASSIGN_ROLES = ["super_admin", "admin", "principal"] as const;

type TaskStatus = "assigned" | "done" | "cancelled";

function cleanText(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function resolveTeacherId(uid: string): Promise<string | null> {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const fromDoc = userSnap.exists ? (userSnap.data() as Record<string, unknown>).teacherId : undefined;
  if (typeof fromDoc === "string" && fromDoc.trim()) return fromDoc;
  const teacherSnap = await db.collection("teachers").where("uid", "==", uid).limit(1).get();
  return teacherSnap.empty ? null : teacherSnap.docs[0].id;
}

// GET /api/admin/tasks?teacherId=&status= — reviewers see all, teachers see own.
// Single-field queries only (no composite index); filtering/sorting in memory.
export async function GET(req: Request) {
  const token = await requireAdminOrPrincipal(req);
  const role = token ? await resolveRole(token) : undefined;
  const db = adminDb();
  const { searchParams } = new URL(req.url);

  if (token && role && (ASSIGN_ROLES as readonly string[]).includes(role)) {
    const teacherId = searchParams.get("teacherId") || "";
    const status = searchParams.get("status") || "";
    const snap = teacherId
      ? await db.collection(COLLECTION).where("teacherId", "==", teacherId).limit(100).get()
      : await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const tasks = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .filter((t) => !status || (t as Record<string, unknown>).status === status)
      .sort((a, b) => String((b as Record<string, unknown>).createdAt ?? "").localeCompare(String((a as Record<string, unknown>).createdAt ?? "")));
    return json({ ok: true, tasks });
  }

  // Teacher scope: must own the tasks.
  const user = await verifyBearerToken(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const teacherId = await resolveTeacherId(user.uid);
  if (!teacherId) return json({ ok: false, error: "Teacher profile not linked" }, { status: 403 });
  const snap = await db.collection(COLLECTION).where("teacherId", "==", teacherId).limit(100).get();
  const tasks = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((t) => (t as Record<string, unknown>).status === "assigned" || (t as Record<string, unknown>).status === "done")
    .sort((a, b) => String((b as Record<string, unknown>).createdAt ?? "").localeCompare(String((a as Record<string, unknown>).createdAt ?? "")));
  return json({ ok: true, tasks });
}

// POST /api/admin/tasks — assign a task (admin/principal only).
export async function POST(req: Request) {
  const token = await requireAdminOrPrincipal(req);
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `task-assign:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const teacherId = cleanText(body.teacherId, 128);
    const title = cleanText(body.title, 200);
    const description = cleanText(body.description);
    const dueDate = cleanText(body.dueDate, 32);
    if (!teacherId || !title) {
      return json({ ok: false, error: "Teacher and title are required" }, { status: 400 });
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return json({ ok: false, error: "Due date must be YYYY-MM-DD" }, { status: 400 });
    }
    const db = adminDb();
    const teacherSnap = await db.collection("teachers").doc(teacherId).get();
    if (!teacherSnap.exists) return json({ ok: false, error: "Teacher not found" }, { status: 404 });

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      teacherId,
      teacherName: String((teacherSnap.data() as Record<string, unknown>).fullName ?? ""),
      title,
      description,
      dueDate,
      status: "assigned" as TaskStatus,
      assignedBy: token.uid,
      createdAt: now,
      updatedAt: now
    });

    // Notify the teacher — fire-and-forget.
    const teacherUid = (teacherSnap.data() as Record<string, unknown>).uid;
    if (typeof teacherUid === "string" && teacherUid) {
      void sendPushToUsers([teacherUid], {
        category: "tasks",
        title: "New task assigned",
        body: title,
        route: "/teacher/tasks"
      }).catch(() => undefined);
    }
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign task";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// PATCH /api/admin/tasks — teacher marks done; reviewers may cancel/reopen.
export async function PATCH(req: Request) {
  const user = await verifyBearerToken(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(user);
  const isReviewer = !!role && (ASSIGN_ROLES as readonly string[]).includes(role);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const taskId = cleanText(body.taskId, 128);
    const status = String(body.status ?? "");
    if (!taskId) return json({ ok: false, error: "Task ID is required" }, { status: 400 });

    const ref = adminDb().collection(COLLECTION).doc(taskId);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Task not found" }, { status: 404 });
    const task = snap.data() as Record<string, unknown>;

    if (isReviewer) {
      if (status !== "cancelled" && status !== "assigned" && status !== "done") {
        return json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
    } else {
      // Teachers may only mark their own tasks done.
      if (status !== "done") return json({ ok: false, error: "Access denied" }, { status: 403 });
      const teacherId = await resolveTeacherId(user.uid);
      if (!teacherId || task.teacherId !== teacherId) {
        return json({ ok: false, error: "Access denied" }, { status: 403 });
      }
    }
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
