import { FieldValue } from "firebase-admin/firestore";
import { certificateCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "certificates";

export async function GET(req: Request) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || "";
  const certificateType = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const academicYearId = searchParams.get("academicYearId") || "";

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (studentId) query = query.where("studentId", "==", studentId);
  if (certificateType) query = query.where("certificateType", "==", certificateType);
  if (status) query = query.where("status", "==", status);

  query = query.orderBy("issueDate", "desc").limit(500);

  const snap = await query.get();
  const certificates = snap.docs.map((d) => serializeDoc(d));
  return json({ ok: true, certificates });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "certificates.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = certificateCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      issuedBy: token.uid,
      createdAt: now,
      updatedAt: now,
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
