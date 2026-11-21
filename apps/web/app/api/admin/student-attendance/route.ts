import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import {
  STUDENT_ATTENDANCE_STATUSES,
  isStudentAttendanceStatus,
  studentAttendanceDocId,
  summarizeStudentAttendance
} from "@/lib/studentAttendance";

const COLLECTION = "student_attendance";
const STUDENTS = "students";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const markSchema = z.object({
  date: z.string().regex(DATE_RE),
  class: z.string().min(1).max(50),
  section: z.string().min(1).max(20),
  academicYearId: z.string().max(100).optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1).max(150),
        status: z.enum(STUDENT_ATTENDANCE_STATUSES),
        remark: z.string().max(300).optional()
      })
    )
    .min(1)
    .max(400)
});

/**
 * GET /api/admin/student-attendance?date=YYYY-MM-DD&class=6&section=A
 * Returns the class roster merged with any attendance already marked for the
 * date. Reads: 1 per student + 1 per marked record (bounded by `limit`).
 */
export async function GET(req: Request) {
  const auth = await requirePermission(req, "students.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = String(searchParams.get("date") || "");
  const className = String(searchParams.get("class") || "").trim();
  const section = String(searchParams.get("section") || "").trim();
  const academicYearId = String(searchParams.get("academicYearId") || "").trim();
  const limit = readLimit(searchParams.get("limit"), 300, 400);

  if (!DATE_RE.test(date)) return json({ ok: false, error: "date must be YYYY-MM-DD" }, { status: 400 });
  if (!className || !section) return json({ ok: false, error: "class and section are required" }, { status: 400 });

  try {
    const db = adminDb();

    let rosterQuery: FirebaseFirestore.Query = db
      .collection(STUDENTS)
      .where("class", "==", className)
      .where("section", "==", section);
    if (academicYearId) rosterQuery = rosterQuery.where("academicYearId", "==", academicYearId);

    const markedQuery = db
      .collection(COLLECTION)
      .where("date", "==", date)
      .where("class", "==", className)
      .where("section", "==", section);

    const [rosterSnap, markedSnap] = await Promise.all([
      rosterQuery.limit(limit).get(),
      markedQuery.limit(limit).get()
    ]);

    logFirestoreRead("StudentAttendanceAPI", STUDENTS, rosterSnap, { className, section, academicYearId });
    logFirestoreRead("StudentAttendanceAPI", COLLECTION, markedSnap, { date, className, section });

    const marked = new Map<string, Record<string, unknown>>();
    for (const doc of markedSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      marked.set(String(data.studentId || doc.id.replace(`${date}_`, "")), data);
    }

    const students = rosterSnap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const record = marked.get(doc.id);
        const rawStatus = record?.status;
        return {
          studentId: doc.id,
          studentName: String(data.studentName || data.name || ""),
          admissionNumber: String(data.admissionNumber || ""),
          rollNumber: String(data.rollNumber || ""),
          archived: data.status === "archived",
          status: isStudentAttendanceStatus(rawStatus) ? rawStatus : "",
          remark: String(record?.remark || ""),
          markedBy: String(record?.markedBy || ""),
          updatedAt: toIsoString(record?.updatedAt)
        };
      })
      .filter((student) => !student.archived)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return json({
      ok: true,
      date,
      class: className,
      section,
      academicYearId,
      truncated: rosterSnap.size >= limit,
      summary: summarizeStudentAttendance(students.map((student) => student.status)),
      students
    });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load student attendance") }, { status: 500 });
  }
}

/**
 * POST /api/admin/student-attendance
 * Upserts only the records the client sends (send just the changed rows).
 * Writes: 1 per record; the document id is deterministic (`date_studentId`) so
 * repeated saves are idempotent and never create duplicates.
 */
export async function POST(req: Request) {
  const auth =
    (await requirePermission(req, "students.edit")) ||
    (await requirePermission(req, "attendance.edit"));
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `student-attendance:${auth.uid}`, maxRequests: 40, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 128 * 1024);
  if (bodyLimit) return bodyLimit;

  let parsed: z.infer<typeof markSchema>;
  try {
    parsed = markSchema.parse(await req.json());
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Invalid attendance payload") }, { status: 400 });
  }

  const schoolId = getSchoolId(auth);
  const month = parsed.date.slice(0, 7);
  const now = FieldValue.serverTimestamp();
  const db = adminDb();

  try {
    const studentIds = Array.from(new Set(parsed.records.map((record) => record.studentId)));
    const studentSnaps = await Promise.all(studentIds.map((id) => db.collection(STUDENTS).doc(id).get()));
    const studentById = new Map<string, Record<string, unknown>>();
    for (const snap of studentSnaps) {
      if (snap.exists) studentById.set(snap.id, snap.data() as Record<string, unknown>);
    }

    const batch = db.batch();
    let written = 0;

    for (const record of parsed.records) {
      const student = studentById.get(record.studentId);
      if (!student) continue;
      if (student.status === "archived") continue;

      const ref = db.collection(COLLECTION).doc(studentAttendanceDocId(parsed.date, record.studentId));
      batch.set(
        ref,
        {
          studentId: record.studentId,
          studentName: String(student.studentName || student.name || ""),
          admissionNumber: String(student.admissionNumber || ""),
          class: parsed.class,
          section: parsed.section,
          date: parsed.date,
          month,
          status: record.status,
          remark: record.remark?.trim() || "",
          schoolId: String(student.schoolId || schoolId),
          branchId: String(student.branchId || "default-branch"),
          academicYearId: String(parsed.academicYearId || student.academicYearId || ""),
          markedBy: auth.uid,
          markedByName: String(auth.name || auth.email || ""),
          updatedAt: now
        },
        { merge: true }
      );
      written += 1;
    }

    if (written > 0) await batch.commit();

    return json({ ok: true, written, skipped: parsed.records.length - written, date: parsed.date });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to save student attendance") }, { status: 500 });
  }
}

function toIsoString(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") {
    try {
      return maybe.toDate().toISOString();
    } catch {
      return "";
    }
  }
  return typeof value === "string" ? value : "";
}

export const dynamic = "force-dynamic";
