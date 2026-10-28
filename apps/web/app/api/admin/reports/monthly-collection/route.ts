import { NextRequest } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
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
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    if (isFirestoreQuotaPaused()) {
      return firestoreQuotaResponse();
    }

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const fromParam = searchParams.get("from") || "";
    const toParam = searchParams.get("to") || "";
    const rangeStart = fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(year, 0, 1);
    const rangeEnd = toParam ? new Date(`${toParam}T23:59:59.999`) : new Date(year, 11, 31, 23, 59, 59, 999);

    const paymentsSnap = await db.collection('payments')
      .where("createdAt", ">=", rangeStart)
      .where("createdAt", "<=", rangeEnd)
      .orderBy("createdAt", "asc")
      .limit(5000)
      .get();
    logFirestoreRead("MonthlyCollectionReportAPI", "payments", paymentsSnap, { year, fromParam, toParam, limit: 5000 });
    const byMonth = new Map<string, { count: number; total: number }>();

    paymentsSnap.docs.forEach((d) => {
      const data = d.data();
      const rawDate = data.paymentDate || data.createdAt;
      const dte =
        typeof rawDate === "string"
          ? new Date(rawDate)
          : rawDate && typeof rawDate.toDate === "function"
            ? rawDate.toDate()
            : null;
      if (!dte || isNaN(dte.getTime())) return;
      if (dte < rangeStart || dte > rangeEnd) return;
      const key = `${dte.getFullYear()}-${String(dte.getMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key) ?? { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(data.amountPaid) || 0;
      byMonth.set(key, existing);
    });

    const months: Array<{ month: number; monthName: string; monthKey: string; year: number; count: number; total: number }> = [];
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const entry = byMonth.get(key);
      months.push({
        month: cursor.getMonth() + 1,
        monthName: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
        monthKey: key,
        year: cursor.getFullYear(),
        count: entry?.count ?? 0,
        total: entry?.total ?? 0
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return json({ success: true, year, months, truncated: paymentsSnap.size >= 5000 });
  } catch (error) {
    console.error('Error generating monthly collection report:', error);
    return json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

