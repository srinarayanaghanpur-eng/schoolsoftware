import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "subject_assignments";

const assignmentSchema = z.object({
  kind: z.enum(["subject", "elective", "class_teacher"]).default("subject"),
  className: z.string().trim().min(1).max(50),
  section: z.string().trim().max(10).optional().default(""),
  subjectName: z.string().trim().max(120).optional().default(""),
  teacherId: z.string().trim().max(100).optional().default(""),
  teacherName: z.string().trim().max(160).optional().default(""),
  periodsPerWeek: z.coerce.number().int().min(0).max(40).optional().default(0),
  academicYearId: z.string().trim().max(100).optional().default("")
});

export async function GET(req: Request) {
  const auth = await requirePermission(req, "academics.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(500).get();
    const assignments = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, assignments });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load assignments") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "academics.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `assignment-create:${auth.uid}`, maxRequests: 40, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 8 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = assignmentSchema.parse(await req.json());
    if (parsed.kind !== "class_teacher" && !parsed.subjectName) {
      return json({ ok: false, error: "Subject is required for subject/elective assignments" }, { status: 400 });
    }
    if (!parsed.teacherId && !parsed.teacherName) {
      return json({ ok: false, error: "Select a teacher" }, { status: 400 });
    }
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      schoolId: getSchoolId(auth),
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to assign") }, { status: 400 });
  }
}
