import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

function num(value: unknown) {
  return Number(value) || 0;
}

function totalFeeForStudent(student: Record<string, unknown>) {
  const totalFeeAmount = num(student.totalFeeAmount);
  if (totalFeeAmount > 0) return totalFeeAmount;
  return num(student.annualEnrollmentFee) + num(student.commitmentFee) + num(student.transportFee) + num(student.feeBalanceCarriedForward);
}

function paidForStudent(student: Record<string, unknown>, payments: Array<Record<string, unknown>>) {
  const paymentTotal = payments
    .filter((p) => String(p.status || "completed").toLowerCase() === "completed")
    .reduce((sum, p) => sum + num(p.amountPaid), 0);
  return Math.max(num(student.totalFeesPaid), paymentTotal);
}

function outstandingForStudent(student: Record<string, unknown>, paid: number) {
  const totalFee = totalFeeForStudent(student);
  const storedDue = num(student.totalFeesDue);

  if (storedDue > 0 && totalFee > 0 && storedDue + paid <= totalFee + 1) {
    return storedDue;
  }
  if (storedDue > 0) {
    return Math.max(0, storedDue - paid);
  }
  return Math.max(0, totalFee - paid);
}

function dateString(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return null;
}

/**
 * GET /api/admin/reports/student-wise
 * Generate student-wise fee report
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const classFilter = searchParams.get('class');

    let query: any = db.collection('students');
    if (classFilter) {
      query = query.where('class', '==', classFilter);
    }

    query = query.orderBy('studentName');

    const snapshot = await query.get();
    const students = snapshot.docs.map((d: QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data()
    }));

    const paymentsSnapshot = await db.collection('payments').get();
    const paymentsByStudent: Record<string, any[]> = {};

    paymentsSnapshot.forEach((doc) => {
      const payment = doc.data();
      if (!paymentsByStudent[payment.studentId]) {
        paymentsByStudent[payment.studentId] = [];
      }
      paymentsByStudent[payment.studentId].push(payment);
    });

    const report = students.map((student: any) => {
      const payments = paymentsByStudent[student.id] || [];
      const totalPaid = paidForStudent(student, payments);
      const totalFee = totalFeeForStudent(student);
      const remainingAmount = outstandingForStudent(student, totalPaid);
      const lastPaymentDate =
        dateString(student.lastPaymentDate) ??
        payments
          .map((payment) => dateString(payment.paymentDate ?? payment.createdAt))
          .filter(Boolean)
          .sort()
          .at(-1) ??
        null;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        previousYearDues: student.feeBalanceCarriedForward || 0,
        totalFeeAmount: totalFee,
        totalFeeDue: totalFee,
        totalPaid,
        remainingAmount,
        feeStatus: remainingAmount === 0 ? "paid" : totalPaid > 0 ? "partial" : student.feeStatus || "pending",
        lastPaymentDate
      };
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating student-wise report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
