import { NextRequest } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission, json } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { resolveFeeState } from "@/lib/feeModel";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/attendance-fee
 * Generate attendance vs fee report
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const classFilter = searchParams.get('class');
    const sectionFilter = searchParams.get('section');
    const minAttendance = searchParams.get('minAttendance');
    const maxAttendance = searchParams.get('maxAttendance');
    const academicYearId = searchParams.get('academicYearId') || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 100, 500);

    let query: FirebaseFirestore.Query = db.collection('students');
    if (classFilter) {
      query = query.where('class', '==', classFilter);
    }
    query = query.limit(500);

    const studentsSnapshot = await query.get();
    logFirestoreRead("AttendanceFeeReportAPI", "students", studentsSnapshot, { classFilter, sectionFilter, pageSize });
    let students = studentsSnapshot.docs
      .map((d: QueryDocumentSnapshot) => ({
        id: d.id,
        ...d.data()
      }))
      .filter((student: any) => {
        if (academicYearId && student.academicYearId && student.academicYearId !== academicYearId) return false;
        if (sectionFilter && student.section !== sectionFilter && student.sectionId !== sectionFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => String(a.studentName || "").localeCompare(String(b.studentName || "")))
      .slice(0, pageSize);

    let report = students.map((student: any) => {
      const fee = resolveFeeState(student);
      const attendance = student.attendancePercentage || 0;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        attendancePercentage: attendance,
        annualEnrollmentFee: fee.originalFee,
        commitmentFee: fee.payableFee,
        totalFeeAmount: fee.payableFee,
        totalFeeDue: fee.due,
        totalPaid: fee.paid,
        remainingAmount: fee.due,
        feePaidPercentage:
          fee.payableFee > 0 ? ((fee.paid / fee.payableFee) * 100).toFixed(2) : '0.00',
        feeStatus: fee.status,
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

    return json({
      success: true,
      data: report.sort(
        (a: any, b: any) => b.attendancePercentage - a.attendancePercentage
      ),
      truncated: studentsSnapshot.size >= 500
    });
  } catch (error) {
    console.error('Error generating attendance-fee report:', error);
    return json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

