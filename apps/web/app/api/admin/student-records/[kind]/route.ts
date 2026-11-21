import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";
import { isStudentRecordKind, STUDENT_RECORD_META, STUDENT_RECORD_SCHEMAS } from "@/lib/studentRecords";

export async function GET(req: Request, { params }: { params: { kind: string } }) {
  if (!isStudentRecordKind(params.kind)) return json({ ok: false, error: "Unknown record kind" }, { status: 404 });
  const meta = STUDENT_RECORD_META[params.kind];

  const auth = await requirePermission(req, "students.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(meta.collection).orderBy("createdAt", "desc").limit(200).get();
    const records = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, records });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load records") }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { kind: string } }) {
  if (!isStudentRecordKind(params.kind)) return json({ ok: false, error: "Unknown record kind" }, { status: 404 });
  const meta = STUDENT_RECORD_META[params.kind];

  const auth = await requirePermission(req, "students.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `student-record:${params.kind}:${auth.uid}`, maxRequests: 40, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 16 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = STUDENT_RECORD_SCHEMAS[params.kind].parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(meta.collection).add({
      ...parsed,
      schoolId: getSchoolId(auth),
      recordedBy: auth.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to save record") }, { status: 400 });
  }
}
