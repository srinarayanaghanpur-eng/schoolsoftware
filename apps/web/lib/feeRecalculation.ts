import { adminDb } from "@/lib/firebaseAdmin";
import { resolveFeeState } from "@/lib/feeModel";

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

function dateMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).getTime();
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestPaymentDate(payments: Record<string, unknown>[]): Date | null {
  let latest = 0;
  for (const payment of payments) {
    latest = Math.max(latest, dateMillis(payment.paymentDate), dateMillis(payment.createdAt));
  }
  return latest > 0 ? new Date(latest) : null;
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

  const fee = resolveFeeState(student as Record<string, unknown>);

  const paidAmount = paymentsSnap.docs.reduce(
    (sum, doc) => sum + safeNumber(doc.data().amountPaid),
    0
  );
  const balanceDue = Math.max(0, fee.payableFee - paidAmount);
  const feeStatus: "paid" | "partial" | "pending" =
    balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";
  const lastPaymentDate = latestPaymentDate(paymentsSnap.docs.map((doc) => doc.data()));

  const now = new Date();

  await db.collection("students").doc(studentId).update({
    totalFeesPaid: paidAmount,
    totalFeesDue: balanceDue,
    feeStatus,
    lastPaymentDate,
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
    totalFee: fee.payableFee,
    totalPaid: paidAmount,
    totalConcession: fee.concession,
    dueAmount: balanceDue,
    feeStatus,
    lastPaymentDate,
    updatedAt: now
  }, { merge: true });

  return {
    totalFee: fee.payableFee,
    paidAmount,
    concessionAmount: fee.concession,
    balanceDue,
    feeStatus
  };
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
  const fee = resolveFeeState(student as Record<string, unknown>);
  const feeStatus = fee.status;
  const balanceDue = fee.due;

  if (feeStatus === "paid" || balanceDue <= 0) {
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
