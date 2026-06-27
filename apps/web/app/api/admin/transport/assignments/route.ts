import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { transportAssignmentSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "transport_assignments";

// GET /api/admin/transport/assignments?routeId=
export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const routeId = new URL(req.url).searchParams.get("routeId");
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (routeId) query = query.where("routeId", "==", routeId);
  const snap = await query.get();
  return NextResponse.json({ ok: true, assignments: snap.docs.map((d) => serializeDoc(d)) });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = transportAssignmentSchema.parse(await req.json());
    const db = adminDb();
    const student = await db.collection("students").doc(parsed.studentId).get();
    const ref = await db.collection(COLLECTION).add({ ...parsed, studentName: (student.data()?.studentName as string) || "", createdAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
