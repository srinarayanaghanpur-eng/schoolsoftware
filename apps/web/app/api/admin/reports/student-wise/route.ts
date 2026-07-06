import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

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
    const classFilter = searchParams.get('classId') || searchParams.get('class') || "";
    const sectionFilter = searchParams.get('sectionId') || searchParams.get('section') || "";
    const academicYearId = searchParams.get("academicYearId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 100, 500);

    let query: FirebaseFirestore.Query = db.collection('studentFeeSummaries');
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    query = query.limit(500);

    const snapshot = await query.get();
    logFirestoreRead("StudentWiseReportAPI", "studentFeeSummaries", snapshot, { academicYearId, classFilter, sectionFilter, pageSize });
    const students = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data()
      }))
      .filter((student: any) => {
        if (classFilter && student.classId !== classFilter && student.className !== classFilter && student.class !== classFilter) return false;
        if (sectionFilter && student.sectionId !== sectionFilter && student.sectionName !== sectionFilter && student.section !== sectionFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => String(a.studentName || "").localeCompare(String(b.studentName || "")))
      .slice(0, pageSize);

    const report = students.map((student: any) => {
      const totalPaid = Number(student.totalPaid) || 0;
      const totalFee = Number(student.totalFee) || 0;
      const remainingAmount = Math.max(0, Number(student.dueAmount) || 0);
      const lastPaymentDate = dateString(student.lastPaymentDate);

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.className || student.classId,
        section: student.sectionName || student.sectionId,
        annualEnrollmentFee: 0,
        commitmentFee: 0,
        previousYearDues: 0,
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
