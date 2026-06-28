import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";

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
    const classFilter = searchParams.get('class');

    let query: any = db.collection('students');
    if (classFilter) {
      query = query.where('class', '==', classFilter);
    }

    const studentsSnapshot = await query.get();
    const students = studentsSnapshot.docs.map((d: QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data()
    }));

    const byClass: Record<string, any> = {};

    students.forEach((student: any) => {
      const key = student.class;
      if (!byClass[key]) {
        byClass[key] = {
          class: student.class,
          totalStudents: 0,
          totalFeeAmount: 0,
          totalFeeDue: 0,
          totalFeePaid: 0,
          totalFeeOutstanding: 0,
          students: []
        };
      }

      byClass[key].totalStudents++;
      byClass[key].totalFeeAmount += student.totalFeeAmount || 0;
      byClass[key].totalFeeDue += student.totalFeesDue || 0;
      byClass[key].totalFeePaid += student.totalFeesPaid || 0;
      byClass[key].totalFeeOutstanding += Math.max(0, (student.totalFeesDue || 0) - (student.totalFeesPaid || 0));
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
