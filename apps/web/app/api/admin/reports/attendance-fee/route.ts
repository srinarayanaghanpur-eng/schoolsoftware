import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

function num(value: unknown) {
  return Number(value) || 0;
}

function totalFeeForStudent(student: Record<string, unknown>) {
  const totalFeeAmount = num(student.totalFeeAmount);
  if (totalFeeAmount > 0) return totalFeeAmount;
  return num(student.annualEnrollmentFee) + num(student.commitmentFee) + num(student.transportFee) + num(student.feeBalanceCarriedForward);
}

function paidForStudent(student: Record<string, unknown>) {
  return num(student.totalFeesPaid);
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
    const sectionFilter = searchParams.get('section');
    const minAttendance = searchParams.get('minAttendance');
    const maxAttendance = searchParams.get('maxAttendance');
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 100, 500);

    let query: any = db.collection('students');
    if (classFilter) {
      query = query.where('class', '==', classFilter);
    }
    if (sectionFilter) query = query.where("section", "==", sectionFilter);
    query = query.orderBy("studentName", "asc").limit(pageSize);

    const studentsSnapshot = await query.get();
    logFirestoreRead("AttendanceFeeReportAPI", "students", studentsSnapshot, { classFilter, sectionFilter, pageSize });
    let students = studentsSnapshot.docs.map((d: QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data()
    }));

    let report = students.map((student: any) => {
      const totalPaid = paidForStudent(student);

      const attendance = student.attendancePercentage || 0;
      const totalFee = totalFeeForStudent(student);
      const remainingAmount = outstandingForStudent(student, totalPaid);

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        attendancePercentage: attendance,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        totalFeeAmount: totalFee,
        totalFeeDue: totalFee,
        totalPaid,
        remainingAmount,
        feePaidPercentage: totalFee > 0 ? ((totalPaid / totalFee) * 100).toFixed(2) : '0.00',
        feeStatus: remainingAmount === 0 ? "paid" : totalPaid > 0 ? "partial" : student.feeStatus || "pending",
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
