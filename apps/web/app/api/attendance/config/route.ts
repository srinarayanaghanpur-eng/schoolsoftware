import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { getSchoolSettings } from "@/lib/firestoreServer";

export async function GET(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const settings = await getSchoolSettings();
  return NextResponse.json({
    ok: true,
    requireSelfie: settings.requireSelfie === true,
    campusLatitude: settings.campusLatitude,
    campusLongitude: settings.campusLongitude,
    geofenceRadiusMeters: settings.geofenceRadiusMeters
  });
}
