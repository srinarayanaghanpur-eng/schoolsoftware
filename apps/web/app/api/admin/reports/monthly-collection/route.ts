import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const db = adminDb();

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
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    const paymentsSnap = await db.collection('payments').get();
    const byMonth = new Map<number, { count: number; total: number }>();

    paymentsSnap.docs.forEach((d) => {
      const data = d.data();
      const dateStr = data.paymentDate || data.createdAt;
      if (!dateStr) return;
      const dte = new Date(dateStr);
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
