import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizePortalRequest,
  getPortalLinkedStudents,
  resolveLinkedStudentId,
  verifyStudentLinked
} from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const access = await authorizePortalRequest(req);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.status === 401 ? "Authentication required" : "Portal access denied" },
      { status: access.status }
    );
  }
  const { token, role } = access;

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId");

  const linkedStudents = await getPortalLinkedStudents(token);
  if (linkedStudents.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const studentId = resolveLinkedStudentId(linkedStudents, requestedStudentId);
  if (!studentId) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const valid = await verifyStudentLinked(token, studentId);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const s = studentSnap.data() as Record<string, unknown>;

  // Independent reads run together — serial awaits used to ~4x this route's latency.
  const todayKey = new Date().toISOString().slice(0, 10);
  const [marksSnap, noticeSnap, paymentsSnap, holidaySnap] = await Promise.all([
    db.collection("exam_marks").where("studentId", "==", studentId).limit(500).get(),
    db.collection("notices").orderBy("createdAt", "desc").limit(20).get(),
    db.collection("payments").where("studentId", "==", studentId).orderBy("createdAt", "desc").limit(5).get(),
    db.collection("holidays").where("date", ">=", todayKey).orderBy("date", "asc").limit(5).get()
  ]);
  // Bounded fan-out: one student's distinct exams, capped before the parallel fetch.
  const examIds = [...new Set(marksSnap.docs.map((d) => d.data().examId as string))].slice(0, 50);
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

  const notices = noticeSnap.docs
    .map((d) => d.data())
    .filter((n) => {
      const roles = (n.audienceRoles as string[]) || [];
      const classes = (n.audienceClasses as string[]) || [];
      const roleOk = roles.length === 0 || roles.includes(role as string);
      const classOk = classes.length === 0 || classes.includes(String(s.class || ""));
      return roleOk && classOk;
    })
    .slice(0, 10)
    .map((n) => ({ title: n.title as string, body: n.body as string, createdAt: n.createdAt ? String(n.createdAt) : undefined }));

  const due = Math.max(0, ((s.totalFeesDue as number) || 0) - ((s.totalFeesPaid as number) || 0));

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

  const upcomingHolidays = holidaySnap.docs.map((doc) => {
    const h = doc.data();
    return { title: h.title || h.name || "Holiday", date: h.date || "", type: h.type || "holiday" };
  });

  const feeBalanceCarriedForward = (s.feeBalanceCarriedForward as number) || 0;

  return NextResponse.json({
    ok: true,
    summary: {
      student: { id: studentId, name: s.studentName || "", className: s.class || "", section: s.section || "", admissionNo: s.admissionNumber || "" },
      fees: { total: (s.totalFeeAmount as number) || 0, paid: (s.totalFeesPaid as number) || 0, due, status: s.feeStatus, feeBalanceCarriedForward },

      marks,
      notices,
      recentPayments,
      upcomingHolidays,
    },
    linkedStudents
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
