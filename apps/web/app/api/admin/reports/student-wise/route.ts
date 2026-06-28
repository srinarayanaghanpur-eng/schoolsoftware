import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

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
      const totalPaid = payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amountPaid, 0);

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        totalFeeAmount: student.totalFeeAmount || 0,
        totalFeeDue: student.totalFeesDue || 0,
        totalPaid,
        remainingAmount: Math.max(0, (student.totalFeesDue || 0) - totalPaid),
        feeStatus: student.feeStatus || 'pending',
        lastPaymentDate: student.lastPaymentDate || null
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
