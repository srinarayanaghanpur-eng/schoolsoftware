import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * GET /api/admin/reports/monthly-collection?year=2025
 * Aggregates payments by month for a given year.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const paymentsSnap = await db.collection('payments')
      .where("createdAt", ">=", yearStart)
      .where("createdAt", "<=", yearEnd)
      .orderBy("createdAt", "asc")
      .limit(5000)
      .get();
    logFirestoreRead("MonthlyCollectionReportAPI", "payments", paymentsSnap, { year, limit: 5000 });
    const byMonth = new Map<number, { count: number; total: number }>();

    paymentsSnap.docs.forEach((d) => {
      const data = d.data();
      const rawDate = data.paymentDate || data.createdAt;
      const dte =
        typeof rawDate === "string"
          ? new Date(rawDate)
          : rawDate && typeof rawDate.toDate === "function"
            ? rawDate.toDate()
            : null;
      if (!dte) return;
      if (isNaN(dte.getTime()) || dte.getFullYear() !== year) return;
      const month = dte.getMonth(); // 0-based
      const existing = byMonth.get(month) ?? { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(data.amountPaid) || 0;
      byMonth.set(month, existing);
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = byMonth.get(i);
      return {
        month: i + 1,
        monthName: MONTH_NAMES[i],
        count: m?.count ?? 0,
        total: m?.total ?? 0
      };
    });

    return NextResponse.json({ success: true, year, months });
  } catch (error) {
    console.error('Error generating monthly collection report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
