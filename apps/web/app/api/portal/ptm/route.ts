import { NextResponse } from "next/server";
import { hasPermission } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole, serializeDoc } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(token);
  if (!hasPermission(role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  try {
    const snap = await adminDb().collection("ptm_meetings").orderBy("date", "desc").limit(40).get();
    const meetings = snap.docs.map((doc) => serializeDoc(doc));
    return NextResponse.json({ ok: true, meetings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load PTM meetings" },
      { status: 500 }
    );
  }
}
