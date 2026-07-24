import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId");
  const category = searchParams.get("category");

  const linkedStudents = await getPortalLinkedStudents(token);
  if (linkedStudents.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked" }, { status: 404 });
  }

  const studentId = requestedStudentId && linkedStudents.some((s) => s.id === requestedStudentId)
    ? requestedStudentId
    : linkedStudents[0].id;

  const valid = await verifyStudentLinked(token, studentId);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const studentSnap = await db.collection("students").doc(studentId).get();
  const studentClass = studentSnap.exists ? String((studentSnap.data() as Record<string, unknown>).class || "") : "";

  let query: FirebaseFirestore.Query = db.collection("notices").orderBy("createdAt", "desc").limit(50);

  const noticeSnap = await query.get();
  const role = token.role as string;

  let notices = noticeSnap.docs
    .map((doc) => {
      const n = doc.data() as Record<string, unknown>;
      const created = n.createdAt;
      const dateStr = created
        ? typeof created === "object" && typeof (created as { toDate?: () => Date }).toDate === "function"
          ? (created as { toDate: () => Date }).toDate().toISOString()
          : String(created)
        : "";
      return {
        id: doc.id,
        title: n.title || "",
        body: n.body || "",
        category: (n.category as string) || (n.type as string) || "general",
        audienceRoles: (n.audienceRoles as string[]) || [],
        audienceClasses: (n.audienceClasses as string[]) || [],
        createdAt: dateStr.slice(0, 10),
      };
    })
    .filter((n) => {
      const roleOk = n.audienceRoles.length === 0 || n.audienceRoles.includes(role);
      const classOk = n.audienceClasses.length === 0 || n.audienceClasses.includes(studentClass);
      return roleOk && classOk;
    });

  if (category && category !== "all") {
    notices = notices.filter((n) => n.category === category);
  }

  return NextResponse.json({ ok: true, notices });
}
