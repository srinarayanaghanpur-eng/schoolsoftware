import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

// GET /api/portal/summary?studentId= — parent/student portal view.
// Returns the linked student's profile, fees, attendance %, PUBLISHED exam marks, and notices.
// Only students the signed-in user is linked to (users/{uid}.studentIds) are accessible.
export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const userDoc = await db.collection("users").doc(token.uid).get();
  const studentIds: string[] = (userDoc.data()?.studentIds as string[]) || [];
  if (studentIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("studentId");
  const studentId = requested && studentIds.includes(requested) ? requested : studentIds[0];

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const s = studentSnap.data() as Record<string, unknown>;

  // Published exam marks for this student
  const marksSnap = await db.collection("exam_marks").where("studentId", "==", studentId).get();
  const examIds = [...new Set(marksSnap.docs.map((d) => d.data().examId as string))];
  const publishedExamNames = new Map<string, string>();
  await Promise.all(
    examIds.map(async (eid) => {
      const ex = await db.collection("exams").doc(eid).get();
      if (ex.exists && ex.data()?.status === "published") publishedExamNames.set(eid, ex.data()?.name as string);
    })
  );
  const marks = marksSnap.docs
    .filter((d) => publishedExamNames.has(d.data().examId))
    .map((d) => {
      const m = d.data();
      return { examName: publishedExamNames.get(m.examId) || "", subject: m.subject, marksObtained: m.marksObtained, maxMarks: m.maxMarks, grade: m.grade || "" };
    });

  // Recent notices visible to this role / class
  const noticeSnap = await db.collection("notices").orderBy("createdAt", "desc").limit(20).get();
  const role = token.role as string;
  const notices = noticeSnap.docs
    .map((d) => d.data())
    .filter((n) => {
      const roles = (n.audienceRoles as string[]) || [];
      const classes = (n.audienceClasses as string[]) || [];
      const roleOk = roles.length === 0 || roles.includes(role);
      const classOk = classes.length === 0 || classes.includes(String(s.class || ""));
      return roleOk && classOk;
    })
    .slice(0, 10)
    .map((n) => ({ title: n.title as string, body: n.body as string, createdAt: n.createdAt ? String(n.createdAt) : undefined }));

  const due = Math.max(0, ((s.totalFeesDue as number) || 0) - ((s.totalFeesPaid as number) || 0));

  const paymentsSnap = await db
    .collection("payments")
    .where("studentId", "==", studentId)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  const recentPayments = paymentsSnap.docs.map((doc) => {
    const p = doc.data();
    const created = p.createdAt;
    const dateStr = created
      ? typeof created === "object" && typeof (created as { toDate?: () => Date }).toDate === "function"
        ? (created as { toDate: () => Date }).toDate().toISOString()
        : String(created)
      : "";
    return {
      id: doc.id,
      amountPaid: p.amountPaid || 0,
      paymentMethod: p.paymentMethod || "",
      receiptNumber: p.receiptNumber || "",
      createdAt: dateStr.slice(0, 10),
    };
  });

  return NextResponse.json({
    ok: true,
    summary: {
      student: { id: studentId, name: s.studentName || "", className: s.class || "", section: s.section || "" },
      fees: { total: (s.totalFeeAmount as number) || 0, paid: (s.totalFeesPaid as number) || 0, due, status: s.feeStatus },
      attendancePercentage: (s.attendancePercentage as number) ?? undefined,
      marks,
      notices,
      recentPayments,
    },
    linkedStudentIds: studentIds
  });
}
