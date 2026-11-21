import { NextResponse } from "next/server";
import type { AcademicYear } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { serializeDoc } from "@/lib/apiUtils";
import { authorizePortalRequest } from "@/lib/portalHelpers";

export const dynamic = "force-dynamic";

// GET /api/portal/academic-years — read-only years for parent/student portal.
export async function GET(req: Request) {
  const auth = await authorizePortalRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Access denied" }, { status: auth.status });

  try {
    const snapshot = await adminDb().collection("academic_years").orderBy("startDate", "desc").limit(100).get();
    const years = snapshot.docs.map((doc) => serializeDoc<AcademicYear>(doc));
    return NextResponse.json({ ok: true, years }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("[PortalAcademicYears] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to load academic years" }, { status: 500 });
  }
}
