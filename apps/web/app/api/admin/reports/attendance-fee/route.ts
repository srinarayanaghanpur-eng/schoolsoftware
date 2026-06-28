import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/attendance-fee
 * Generate attendance vs fee report
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const classFilter = searchParams.get('class');
    const minAttendance = searchParams.get('minAttendance');
    const maxAttendance = searchParams.get('maxAttendance');

    let query: any = db.collection('students');
    if (classFilter) {
      query = query.where('class', '==', classFilter);
    }

    const studentsSnapshot = await query.get();
    let students = studentsSnapshot.docs.map((d: QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data()
    }));

    const paymentsSnapshot = await db.collection('payments').get();
    const paymentsByStudent: Record<string, any[]> = {};

    paymentsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      const payment = doc.data();
      if (!paymentsByStudent[payment.studentId]) {
        paymentsByStudent[payment.studentId] = [];
      }
      paymentsByStudent[payment.studentId].push(payment);
    });

    let report = students.map((student: any) => {
      const payments = paymentsByStudent[student.id] || [];
      const totalPaid = payments
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + p.amountPaid, 0);

      const attendance = student.attendancePercentage || 0;
      const feeDue = student.totalFeesDue || 0;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        attendancePercentage: attendance,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        totalFeeAmount: student.totalFeeAmount || 0,
        totalFeeDue: feeDue,
        totalPaid,
        feePaidPercentage: feeDue > 0 ? ((totalPaid / feeDue) * 100).toFixed(2) : '0.00',
        feeStatus: student.feeStatus || 'pending',
        attendanceEligibility: attendance >= 75 ? 'Eligible' : 'Ineligible'
      };
    });

    // Filter by attendance range if provided
    if (minAttendance || maxAttendance) {
      const min = minAttendance ? parseInt(minAttendance) : 0;
      const max = maxAttendance ? parseInt(maxAttendance) : 100;

      report = report.filter(
        (r: any) => r.attendancePercentage >= min && r.attendancePercentage <= max
      );
    }

    return NextResponse.json({
      success: true,
      data: report.sort(
        (a: any, b: any) => b.attendancePercentage - a.attendancePercentage
      )
    });
  } catch (error) {
    console.error('Error generating attendance-fee report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
