/**
 * API Route: Reports (RETIRED)
 *
 * The legacy `GET /api/reports?type=...` stack read fee numbers from the
 * `students` master docs while the current stack (`/api/admin/reports/*`)
 * reads the canonical `studentFeeSummaries` read-model — the two stacks
 * disagreed. This route now answers 410 Gone with the replacement map.
 * `lib/reportService.ts` is unreferenced and kept only for history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated } from '@/lib/apiUtils';

export const dynamic = "force-dynamic";

const REPLACEMENTS: Record<string, string> = {
  "class-wise": "/api/admin/reports/class-wise",
  "student-wise": "/api/admin/reports/student-wise",
  "attendance-fee": "/api/admin/reports/attendance-fee",
  "monthly-collection": "/api/admin/reports/monthly-collection",
  "class-fee-status": "/api/admin/reports/class-wise"
};

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") ?? "";
  return NextResponse.json(
    {
      error: "This report endpoint is retired.",
      useInstead: REPLACEMENTS[type] ?? "/api/admin/reports/class-wise",
      validTypes: Object.keys(REPLACEMENTS)
    },
    { status: 410 }
  );
}
