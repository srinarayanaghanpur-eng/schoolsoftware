import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/class-wise
 * Generate class-wise fee report
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
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 1000, 5000);

    let query: FirebaseFirestore.Query = db.collection('studentFeeSummaries');
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    query = query.limit(pageSize);

    const summariesSnapshot = await query.get();
    logFirestoreRead("ClassWiseReportAPI", "studentFeeSummaries", summariesSnapshot, { academicYearId, classFilter, sectionFilter, pageSize });

    const byClass: Record<string, any> = {};

    summariesSnapshot.docs.forEach((doc) => {
      const student = doc.data();
      if (classFilter && student.classId !== classFilter && student.className !== classFilter && student.class !== classFilter) return;
      if (sectionFilter && student.sectionId !== sectionFilter && student.sectionName !== sectionFilter && student.section !== sectionFilter) return;
      const key = String(student.className || student.classId || "—");
      if (!byClass[key]) {
        byClass[key] = {
          class: key,
          totalStudents: 0,
          totalFeeAmount: 0,
          totalFeeDue: 0,
          totalFeePaid: 0,
          totalFeeOutstanding: 0,
          students: []
        };
      }

      byClass[key].totalStudents++;
      byClass[key].totalFeeAmount += Number(student.totalFee) || 0;
      byClass[key].totalFeeDue += Number(student.totalFee) || 0;
      byClass[key].totalFeePaid += Number(student.totalPaid) || 0;
      byClass[key].totalFeeOutstanding += Number(student.dueAmount) || 0;
      byClass[key].students.push(student);
    });

    const result = Object.values(byClass).map((classData) => ({
      ...classData,
      averageAnnualFee:
        classData.totalStudents > 0
          ? classData.totalFeeAmount / classData.totalStudents
          : 0,
      feePaidPercentage:
        classData.totalFeeDue > 0
          ? ((classData.totalFeePaid / classData.totalFeeDue) * 100).toFixed(2)
          : '0.00'
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating class-wise report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
