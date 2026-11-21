import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(token);
  if (!hasPermission(role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });

  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });

  const db = adminDb();
  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const student = studentSnap.data() as Record<string, unknown>;
  const className = String(student.class || "");

  let homeworkSnap;
  try {
    homeworkSnap = await db.collection("homework")
      .where("className", "==", className)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? "");
    const message = error instanceof Error ? error.message : String(error);
    if (code !== "9" && !/FAILED_PRECONDITION|requires an index/i.test(message)) throw error;
    console.error(`[PortalHomework] Missing Firestore index — using unordered fallback:\n${message}`);
    homeworkSnap = await db.collection("homework").where("className", "==", className).limit(200).get();
  }

  const homework = [...homeworkSnap.docs]
    .sort((a, b) => {
      const left = (a.data().createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() ?? 0;
      const right = (b.data().createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() ?? 0;
      return right - left;
    })
    .slice(0, 50)
    .map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: data.title,
      subject: data.subject,
      description: data.description,
      dueDate: data.dueDate,
      assignedDate: data.assignedDate,
      attachments: data.attachments || [],
      createdAt: data.createdAt,
    };
  });

  return NextResponse.json({ ok: true, homework }, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
