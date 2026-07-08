import { FieldValue } from "firebase-admin/firestore";
import { installmentPlanCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "installment_plans";

function timeValue(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

// GET /api/admin/finance/installments?studentId=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  const studentId = searchParams.get("studentId");
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = searchParams.get("cursor")?.trim() || "";
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  else if (studentId) query = query.where("studentId", "==", studentId);
  else if (schoolId) query = query.where("schoolId", "==", schoolId);

  const snap = await query.limit(500).get();
  logFirestoreRead("FinanceInstallmentsAPI", COLLECTION, snap, { studentId, academicYearId, schoolId, pageSize });
  const filteredDocs = snap.docs
    .filter((doc) => {
      const data = doc.data();
      return (!studentId || String(data.studentId || "") === studentId)
        && (!academicYearId || String(data.academicYearId || "") === academicYearId)
        && (!schoolId || String(data.schoolId || "") === schoolId);
    })
    .sort((left, right) => timeValue(right.data().createdAt) - timeValue(left.data().createdAt));
  const startIndex = cursor ? Math.max(0, filteredDocs.findIndex((doc) => doc.id === cursor) + 1) : 0;
  const pageDocs = filteredDocs.slice(startIndex, startIndex + pageSize);
  const plans = pageDocs.map((d) => serializeDoc(d));
  const nextCursor = startIndex + pageSize < filteredDocs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  return json({ ok: true, plans, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

// POST /api/admin/finance/installments — create a new installment plan.
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = installmentPlanCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();

    const studentSnap = await adminDb().collection("students").doc(parsed.studentId).get();
    const studentData = studentSnap.data();
    const studentName = String(studentData?.studentName ?? "");

    const doc = {
      ...parsed,
      studentName,
      schoolId: String(studentData?.schoolId ?? getSchoolId(token)),
      paidAmount: 0,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    };

    const ref = await adminDb().collection(COLLECTION).add(doc);
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create installment plan";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

