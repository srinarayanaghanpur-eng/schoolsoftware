import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { json, requireAdminOrPrincipal, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { sendPushToUsers } from "@/lib/push/sendPush";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "tasks";
// Keep this aligned with requireAdminOrPrincipal(): the seeded "ADMIN" account
// uses settings_manager and must still be able to review the tasks it assigns.
const ASSIGN_ROLES = ["super_admin", "admin", "settings_manager", "principal"] as const;

type TaskStatus = "assigned" | "done" | "cancelled";
type TaskRecord = { id: string } & Record<string, unknown>;

function cleanText(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isReviewerRole(role: string | undefined): boolean {
  return !!role && (ASSIGN_ROLES as readonly string[]).includes(role);
}

/**
 * Only enforce school scoping when the deployment actually provides a scope
 * (custom claim or SCHOOL_ID). Older single-school tokens have neither, and
 * must keep seeing their existing tasks.
 */
function explicitSchoolScope(token: Record<string, unknown>): string | null {
  const claim = cleanText(token.school_id, 128) || cleanText(token.schoolId, 128);
  if (claim) return claim;
  return cleanText(process.env.SCHOOL_ID, 128) || null;
}

/**
 * A teacher can be linked through a custom claim, the users/{uid} profile, or
 * the teachers/{id}.uid back-reference. Legacy accounts often only have one or
 * two of those, so keep every candidate instead of trusting a single source.
 *
 * The caller's own uid is always added as a candidate because older task docs
 * were sometimes written with the login uid in `teacherId`. `linked` reports
 * whether a real teacher profile was found so an unrelated account still gets
 * the "not linked" response.
 */
async function resolveTeacherIds(
  uid: string,
  claimTeacherId?: unknown
): Promise<{ ids: string[]; linked: boolean }> {
  const ids = new Set<string>();
  let linked = false;

  const claim = cleanText(claimTeacherId, 128);
  if (claim) {
    ids.add(claim);
    linked = true;
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const fromDoc = userSnap.exists ? (userSnap.data() as Record<string, unknown>).teacherId : undefined;
  const docId = cleanText(fromDoc, 128);
  if (docId) {
    ids.add(docId);
    linked = true;
  }

  const teacherSnap = await db.collection("teachers").where("uid", "==", uid).limit(1).get();
  if (!teacherSnap.empty) {
    ids.add(teacherSnap.docs[0].id);
    linked = true;
  }

  // Keep the uid inside Firestore's 10-value `in` limit.
  const candidates = [...ids].slice(0, 9);
  if (!candidates.includes(uid)) candidates.push(uid);
  return { ids: candidates, linked };
}

async function tasksForTeacher(uid: string, claimTeacherId?: unknown): Promise<TaskRecord[] | null> {
  const db = adminDb();
  const { ids, linked } = await resolveTeacherIds(uid, claimTeacherId);
  const byId = new Map<string, TaskRecord>();

  if (ids.length > 0) {
    const snap = ids.length === 1
      ? await db.collection(COLLECTION).where("teacherId", "==", ids[0]).limit(100).get()
      : await db.collection(COLLECTION).where("teacherId", "in", ids).limit(100).get();
    for (const doc of snap.docs) byId.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });
  }

  // Newly created assignments also stamp teacherUid, so a teacher still sees the
  // task if their master record and auth link use different ids.
  const byUid = await db.collection(COLLECTION).where("teacherUid", "==", uid).limit(100).get();
  for (const doc of byUid.docs) byId.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });

  // No profile and no task actually addressed to this uid: keep the "not
  // linked" error. A legacy task keyed by the login uid still counts as owned.
  if (!linked && byId.size === 0 && byUid.empty) return null;
  return [...byId.values()];
}

function newestFirst(a: TaskRecord, b: TaskRecord): number {
  return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
}

// GET /api/admin/tasks?teacherId=&status= — reviewers see all, teachers see own.
// Single-field queries only (no composite index); filtering/sorting in memory.
export async function GET(req: Request) {
  const reviewer = await requireAdminOrPrincipal(req);
  const role = reviewer ? await resolveRole(reviewer) : undefined;
  const db = adminDb();

  if (reviewer && isReviewerRole(role)) {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId") || "";
    const status = searchParams.get("status") || "";
    const schoolId = explicitSchoolScope(reviewer);
    const snap = teacherId
      ? await db.collection(COLLECTION).where("teacherId", "==", teacherId).limit(100).get()
      : await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const tasks = snap.docs
      .map((d): TaskRecord => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      // Legacy tasks predate schoolId and remain visible to their reviewer.
      .filter((t) => (!schoolId || !t.schoolId || t.schoolId === schoolId) && (!status || t.status === status))
      .sort(newestFirst);
    return json({ ok: true, tasks });
  }

  // Teacher scope: must own the tasks.
  const user = reviewer ?? await verifyBearerToken(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const owned = await tasksForTeacher(user.uid, user.teacherId);
  if (!owned) return json({ ok: false, error: "Teacher profile not linked" }, { status: 403 });
  const tasks = owned
    .filter((t) => t.status === "assigned" || t.status === "done")
    .sort(newestFirst);
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
    const requestedId = cleanText(body.teacherId, 128);
    const requestedUid = cleanText(body.teacherUid, 128);
    const title = cleanText(body.title, 200);
    const description = cleanText(body.description);
    const dueDate = cleanText(body.dueDate, 32);
    if (!requestedId || !title) {
      return json({ ok: false, error: "Teacher and title are required" }, { status: 400 });
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return json({ ok: false, error: "Due date must be YYYY-MM-DD" }, { status: 400 });
    }

    const db = adminDb();
    const teacherSnap = await db.collection("teachers").doc(requestedId).get();
    let teacher = teacherSnap.exists ? (teacherSnap.data() as Record<string, unknown>) : null;
    let teacherId = requestedId;
    let teacherUid = cleanText(teacher?.uid, 128);

    if (!teacher) {
      // The staff directory can surface a teacher login before its master record
      // exists. Accept that login so the task still reaches the teacher's device.
      const loginSnap = await db.collection("users").doc(requestedUid || requestedId).get();
      const login = loginSnap.exists ? (loginSnap.data() as Record<string, unknown>) : null;
      if (!login || cleanText(login.role, 32).toLowerCase() !== "teacher") {
        return json({ ok: false, error: "Teacher not found" }, { status: 404 });
      }
      teacher = login;
      teacherUid = loginSnap.id;
      teacherId = cleanText(login.teacherId, 128) || loginSnap.id;
    }

    // Legacy teacher masters sometimes lack the uid back-reference. Recover it
    // from the login profile so the task still reaches the device via push and
    // the teacher can find it through teacherUid.
    if (!teacherUid && teacherSnap.exists) {
      const loginSnap = await db.collection("users").where("teacherId", "==", teacherId).limit(1).get();
      if (!loginSnap.empty) teacherUid = loginSnap.docs[0].id;
    }

    const reviewerSchoolId = getSchoolId(token);
    const scope = explicitSchoolScope(token);
    const teacherSchoolId = cleanText(teacher.schoolId, 128);
    if (scope && teacherSchoolId && teacherSchoolId !== scope) {
      return json({ ok: false, error: "Teacher is outside your workspace" }, { status: 403 });
    }

    const teacherName =
      cleanText(teacher.fullName, 160) ||
      cleanText(teacher.displayName, 160) ||
      cleanText(teacher.name, 160) ||
      cleanText(teacher.internalEmail, 160) ||
      cleanText(teacher.email, 160);

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      teacherId,
      teacherUid,
      teacherName,
      schoolId: teacherSchoolId || reviewerSchoolId,
      title,
      description,
      dueDate,
      status: "assigned" as TaskStatus,
      assignedBy: token.uid,
      createdAt: now,
      updatedAt: now
    });

    // Notify the teacher — fire-and-forget.
    if (teacherUid) {
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
  const isReviewer = isReviewerRole(role);

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
      const scope = explicitSchoolScope(user);
      const taskSchoolId = cleanText(task.schoolId, 128);
      if (scope && taskSchoolId && taskSchoolId !== scope) {
        return json({ ok: false, error: "Task is outside your workspace" }, { status: 403 });
      }
      if (status !== "cancelled" && status !== "assigned" && status !== "done") {
        return json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
    } else {
      // Teachers may only mark their own tasks done.
      if (status !== "done") return json({ ok: false, error: "Access denied" }, { status: 403 });
      const { ids: teacherIds } = await resolveTeacherIds(user.uid, user.teacherId);
      const taskTeacherId = cleanText(task.teacherId, 128);
      const taskTeacherUid = cleanText(task.teacherUid, 128);
      const ownsTask =
        (!!taskTeacherId && teacherIds.includes(taskTeacherId)) ||
        (!!taskTeacherUid && taskTeacherUid === user.uid);
      if (!ownsTask) {
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
