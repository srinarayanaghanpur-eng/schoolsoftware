import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const db = adminDb();

export async function GET(req: Request) {
  const token = await requirePermission(req, "promotions.view");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId");
    const classStr = searchParams.get("class");
    const studentId = searchParams.get("studentId");

    let query: FirebaseFirestore.Query = db.collection("promotions").orderBy("createdAt", "desc");

    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (classStr) query = query.where("fromClass", "==", classStr);
    if (studentId) query = query.where("studentId", "==", studentId);

    const snapshot = await query.limit(200).get();
    const records = snapshot.docs.map((doc) => serializeDoc(doc));

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    console.error("Error fetching promotion history:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch promotion history" }, { status: 500 });
  }
}
