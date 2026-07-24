import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(token.role as Role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (studentId) {
    const linked = await verifyStudentLinked(token, studentId);
    if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });
  }

  const db = adminDb();
  const downloadsSnap = await db.collection("downloads")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const downloads = downloadsSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: data.title,
      description: data.description,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      category: data.category || "general",
      createdAt: data.createdAt,
    };
  });

  return NextResponse.json({ ok: true, downloads });
}
