import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, resolveRole, serializeDoc, json } from "@/lib/apiUtils";
import { roleHasPermission } from "@/lib/rbacAdmin";
import { feeStatusFor, resolveFeeState } from "@/lib/feeModel";
import { getReceiptsByStudent } from "@/lib/receiptService";

type FirestoreRecord = Record<string, unknown>;

function timeValue(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function byNewest(field: string) {
  return (left: FirestoreRecord, right: FirestoreRecord) =>
    timeValue(right[field] ?? right.createdAt) - timeValue(left[field] ?? left.createdAt);
}

function recordYears(record: FirestoreRecord): string[] {
  return [record.academicYearId, record.academicYear]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function matchesYear(record: FirestoreRecord, yearId: string, yearLabel: string): boolean {
  if (!yearId && !yearLabel) return true;
  const values = recordYears(record);
  // Legacy records created before academic years were enforced have no year
  // field; keep them visible instead of silently hiding financial history.
  if (values.length === 0) return true;
  return values.some((value) => value === yearId || (Boolean(yearLabel) && value === yearLabel));
}

async function resolveAcademicYear(
  db: ReturnType<typeof adminDb>,
  student: FirestoreRecord
): Promise<{ id: string; label: string }> {
  let id = String(student.academicYearId || "").trim();
  const legacyLabel = String(student.academicYear || "").trim();
  if (!id && legacyLabel) {
    const byName = await db.collection("academic_years").where("name", "==", legacyLabel).limit(1).get();
    if (!byName.empty) return { id: byName.docs[0].id, label: legacyLabel };
    // No matching year doc; keep the legacy label so year filtering still works.
    return { id: "", label: legacyLabel };
  }
  if (!id) {
    const active = await db.collection("academic_years").where("isActive", "==", true).limit(1).get();
    if (!active.empty) id = active.docs[0].id;
  }
  if (!id) return { id: "", label: "" };
  if (/^\d{4}-\d{2}$/.test(id)) return { id, label: id };
  const snap = await db.collection("academic_years").doc(id).get();
  return { id, label: String(snap.data()?.name || legacyLabel || "").trim() };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(request, "students.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const studentId = params.id;

  try {
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) {
      return json({ ok: false, error: "Student not found" }, { status: 404 });
    }

    const student = serializeDoc(studentSnap as unknown as FirebaseFirestore.QueryDocumentSnapshot);
    const academicYear = await resolveAcademicYear(db, student);
    const role = await resolveRole(token);

    const [
      canViewFees,
      canViewCertificates,
      canCreateCertificate,
      canEdit,
      canDelete,
      canCollectFees,
      canViewExams
    ] = await Promise.all([
      roleHasPermission(role, "fees.view"),
      roleHasPermission(role, "certificates.view"),
      roleHasPermission(role, "certificates.create"),
      roleHasPermission(role, "students.edit"),
      roleHasPermission(role, "students.delete"),
      roleHasPermission(role, "fees.create"),
      roleHasPermission(role, "exams.view")
    ]);

    const [paymentsSnap, receipts, certsSnap, logsSnap] = await Promise.all([
      canViewFees
        ? db.collection("payments")
            .where("studentId", "==", studentId)
            .where("status", "==", "completed")
            .limit(300)
            .get()
        : Promise.resolve(null),
      canViewFees ? getReceiptsByStudent(studentId, 100) : Promise.resolve([]),
      canViewCertificates
        ? db.collection("certificates").where("studentId", "==", studentId).limit(200).get()
        : Promise.resolve(null),
      db.collection("audit_logs")
        .where("entityType", "==", "student")
        .where("entityId", "==", studentId)
        .limit(300)
        .get()
    ]);

    const allPayments = paymentsSnap ? paymentsSnap.docs.map((doc) => serializeDoc(doc)) : [];
    const payments = allPayments
      .filter((payment) => matchesYear(payment, academicYear.id, academicYear.label))
      .sort(byNewest("paymentDate"));

    const certificates = certsSnap
      ? certsSnap.docs.map((doc) => serializeDoc(doc)).sort(byNewest("issueDate"))
      : [];

    const auditLogs = logsSnap.docs
      .map((doc) => serializeDoc(doc))
      .sort(byNewest("createdAt"))
      .slice(0, 100);

    const examMarks = canViewExams ? await loadExamMarks(db, student, academicYear) : [];

    const fee = resolveFeeState(student);
    // The stored payable fee is a lifetime figure, so the summary must use
    // lifetime completed payments. `payments` stays year-scoped for lists.
    const paid = canViewFees
      ? allPayments.length
        ? allPayments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amountPaid || 0)), 0)
        : fee.paid
      : 0;
    const due = Math.max(0, fee.payableFee - paid);

    return json({
      ok: true,
      student,
      academicYear,
      permissions: {
        canViewFees,
        canViewCertificates,
        canCreateCertificate,
        canEdit,
        canDelete,
        canCollectFees,
        canViewExams
      },
      feeSummary: canViewFees
        ? {
            originalFee: fee.originalFee,
            payableFee: fee.payableFee,
            concession: fee.concession,
            paid,
            due,
            status: feeStatusFor(due, paid)
          }
        : null,
      payments: canViewFees ? payments : [],
      receipts: canViewFees ? receipts : [],
      certificates,
      examMarks,
      auditLogs
    });
  } catch (error) {
    console.error("[student-profile] load failed:", error);
    return json({ ok: false, error: "Failed to load student profile" }, { status: 500 });
  }
}

/**
 * Marks live in the top-level `exam_marks` collection (see
 * api/admin/exams/[id]/marks). Read the student's marks once, then join the
 * exam documents and filter by the student's class/section/academic year.
 */
async function loadExamMarks(
  db: ReturnType<typeof adminDb>,
  student: FirestoreRecord,
  academicYear: { id: string; label: string }
): Promise<FirestoreRecord[]> {
  const studentId = String(student.id || "");
  if (!studentId) return [];

  const marksSnap = await db.collection("exam_marks").where("studentId", "==", studentId).limit(500).get();
  if (marksSnap.empty) return [];

  const marks = marksSnap.docs.map((doc) => serializeDoc(doc));
  const examIds = Array.from(
    new Set(marks.map((mark) => String(mark.examId || "")).filter(Boolean))
  );
  if (examIds.length === 0) return [];

  const examSnaps = await db.getAll(...examIds.map((id) => db.collection("exams").doc(id)));
  const exams = new Map<string, FirestoreRecord>();
  for (const snap of examSnaps) {
    if (snap.exists) exams.set(snap.id, serializeDoc(snap as unknown as FirebaseFirestore.QueryDocumentSnapshot));
  }

  const className = String(student.class || "");
  const section = String(student.section || "");

  const eligibleExamIds = new Set<string>();
  for (const [examId, exam] of exams) {
    const examClassName = String(exam.className || exam.class || "");
    if (className && examClassName && examClassName !== className) continue;
    const examSection = String(exam.section || "");
    if (section && examSection && examSection !== section) continue;
    if (!matchesYear(exam, academicYear.id, academicYear.label)) continue;
    eligibleExamIds.add(examId);
  }

  return marks
    .filter((mark) => eligibleExamIds.has(String(mark.examId || "")))
    .map((mark) => {
      const exam = exams.get(String(mark.examId || "")) ?? {};
      return {
        ...mark,
        examName: String(exam.name || exam.examName || ""),
        examType: String(exam.examType || ""),
        className: String(exam.className || exam.class || ""),
        section: String(exam.section || ""),
        examStartDate: exam.startDate ?? exam.createdAt ?? null
      };
    })
    .sort((left, right) => timeValue(right.examStartDate) - timeValue(left.examStartDate));
}
