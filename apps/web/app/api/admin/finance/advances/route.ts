import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { salaryAdvanceCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "salary_advances";

// GET /api/admin/finance/advances?teacherId=
export async function GET(req: Request) {
  const token = await requirePermission(req, "payroll.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const teacherId = new URL(req.url).searchParams.get("teacherId");
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (teacherId) query = query.where("teacherId", "==", teacherId);
  // Hard read cap to keep query cost bounded (Firestore free-tier quota).
  const snap = await query.limit(500).get();
  const advances = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, advances });
}

// POST /api/admin/finance/advances — record a salary advance for a teacher.
export async function POST(req: Request) {
  const token = await requirePermission(req, "payroll.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = salaryAdvanceCreateSchema.parse(await req.json());
    const db = adminDb();
    const teacher = await db.collection("teachers").doc(parsed.teacherId).get();
    const ref = await db.collection(COLLECTION).add({
      ...parsed,
      teacherName: (teacher.data()?.fullName as string) || "",
      recovered: false,
      createdBy: token.uid,
      createdAt: FieldValue.serverTimestamp()
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record advance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
