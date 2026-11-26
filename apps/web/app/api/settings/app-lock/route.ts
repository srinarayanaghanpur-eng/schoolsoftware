import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { getSchoolSettings } from "@/lib/firestoreServer";

export async function GET(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const settings = await getSchoolSettings();
  const appLock = {
    ...DEFAULT_SETTINGS.appLock,
    ...(settings.appLock ?? {})
  };

  return NextResponse.json({ ok: true, appLock });
}
