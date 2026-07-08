import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type FeeSummaryResult = {
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  balanceDue: number;
  feeStatus: "paid" | "partial" | "pending";
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

export async function recalculateStudentFeeSummary(
  studentId: string,
  academicYearId?: string
): Promise<FeeSummaryResult> {
  const db = adminDb();

  const [studentSnap, paymentsSnap] = await Promise.all([
    db.collection("students").doc(studentId).get(),
    db.collection("payments")
      .where("studentId", "==", studentId)
      .where("status", "==", "completed")
      .get()
  ]);

  if (!studentSnap.exists) throw new Error("Student not found");

  const student = studentSnap.data()!;

  // Use provided academicYearId, or fall back to student doc's value.
  const effectiveAcademicYearId = academicYearId || String(student.academicYearId || "");

  const totalFee = safeNumber(student.totalFeeAmount);
  const totalConcession = safeNumber(student.totalConcessionAmount);
  const committedPayable = safeNumber(student.committedPayableFee || student.commitmentFee);
  const assignedFee = totalFee > 0 ? totalFee : committedPayable;

  const paidAmount = paymentsSnap.docs.reduce(
    (sum, doc) => sum + safeNumber(doc.data().amountPaid),
    0
  );

  const concessionAmount = safeNumber(student.totalConcessionAmount) || Math.max(0, safeNumber(student.originalFeeAmount || student.annualEnrollmentFee) - assignedFee);
  const balanceDue = Math.max(0, assignedFee - paidAmount);
  const feeStatus: "paid" | "partial" | "pending" =
    balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";

  const now = new Date();

  await db.collection("students").doc(studentId).update({
    totalFeesPaid: paidAmount,
    totalFeesDue: balanceDue,
    feeStatus,
    feeLastUpdated: now
  });

  const summaryId = `${studentId}_${effectiveAcademicYearId || "default"}`;
  await db.collection("studentFeeSummaries").doc(summaryId).set({
    studentId,
    studentName: String(student.studentName || ""),
    admissionNumber: String(student.admissionNumber || ""),
    schoolId: String(student.schoolId || "default-school"),
    branchId: String(student.branchId || "default-branch"),
    academicYearId: effectiveAcademicYearId || "",
    classId: String(student.classId || student.class || ""),
    sectionId: String(student.sectionId || student.section || ""),
    className: String(student.class || student.classId || ""),
    sectionName: String(student.section || student.sectionId || ""),
    phone: String(student.phone || student.fatherPhone || ""),
    totalFee: assignedFee,
    totalPaid: paidAmount,
    totalConcession: concessionAmount,
    dueAmount: balanceDue,
    feeStatus,
    lastPaymentDate: now,
    updatedAt: now
  }, { merge: true });

  return { totalFee: assignedFee, paidAmount, concessionAmount, balanceDue, feeStatus };
}

export async function validatePaymentAllowed(
  studentId: string,
  amountPaid: number,
  academicYearId: string
): Promise<{ allowed: boolean; error?: string; balanceDue: number; feeStatus: string }> {
  const db = adminDb();
  const studentSnap = await db.collection("students").doc(studentId).get();

  if (!studentSnap.exists) {
    return { allowed: false, error: "Student not found", balanceDue: 0, feeStatus: "unknown" };
  }

  const student = studentSnap.data()!;
  const feeStatus = String(student.feeStatus || "pending");
  const totalFeesDue = safeNumber(student.totalFeesDue);
  const totalFeesPaid = safeNumber(student.totalFeesPaid);

  if (feeStatus === "paid" || (totalFeesDue <= 0 && totalFeesPaid > 0)) {
    return {
      allowed: false,
      error: "This student has already paid the full fee. No due amount pending.",
      balanceDue: 0,
      feeStatus: "paid"
    };
  }

  const balanceDue = Math.max(0, totalFeesDue);

  if (balanceDue <= 0) {
    return {
      allowed: false,
      error: "No pending due amount for this student.",
      balanceDue: 0,
      feeStatus: "paid"
    };
  }

  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return {
      allowed: false,
      error: "Payment amount must be greater than 0.",
      balanceDue,
      feeStatus
    };
  }

  if (amountPaid > balanceDue) {
    return {
      allowed: false,
      error: `Payment amount cannot be greater than pending due of ₹${balanceDue.toLocaleString("en-IN")}.`,
      balanceDue,
      feeStatus
    };
  }

  return { allowed: true, balanceDue, feeStatus };
}
