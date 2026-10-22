import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { getSchoolSettings } from "@/lib/firestoreServer";

const DEFAULT_SUPPORT_PHONE = "6300038389";

// GET /api/portal/support-contact — school office number for Help & support.
// Any signed-in user (staff + parents); the number is public footer info.
export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const settings = await getSchoolSettings();
  const configured = typeof settings.supportPhone === "string" ? settings.supportPhone.trim() : "";
  return NextResponse.json(
    { ok: true, adminPhone: configured || DEFAULT_SUPPORT_PHONE },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
