import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuthenticated, resolveRole, serializeDoc } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAuthenticated(req);
    const role = decodedToken ? await resolveRole(decodedToken) : undefined;
    if (!decodedToken || role !== "teacher") {
      return NextResponse.json({ ok: false, error: "Teacher access required" }, { status: 403 });
    }

    const db = adminDb();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userSnapshot.exists ? (userSnapshot.data() as Record<string, unknown>) : undefined;
    const teacherId =
      typeof decodedToken.teacherId === "string"
        ? decodedToken.teacherId
        : typeof userData?.teacherId === "string"
          ? (userData.teacherId as string)
          : "";

    if (!teacherId) {
      return NextResponse.json({ ok: false, error: "Teacher profile is missing." }, { status: 404 });
    }

    const teacherSnapshot = await db.collection("teachers").doc(teacherId).get();
    const teacherName = teacherSnapshot.exists
      ? String((teacherSnapshot.data() as Record<string, unknown>).fullName ?? "")
      : "";

    const snap = await db
      .collection("subject_assignments")
      .where("teacherId", "==", teacherId)
      .limit(200)
      .get();

    const assignments = snap.docs
      .map((doc) => serializeDoc(doc))
      .sort((a, b) => String(a.className ?? "").localeCompare(String(b.className ?? "")));

    return NextResponse.json(
      { ok: true, teacherId, teacherName, assignments },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load assignments" },
      { status: 400 }
    );
  }
}
