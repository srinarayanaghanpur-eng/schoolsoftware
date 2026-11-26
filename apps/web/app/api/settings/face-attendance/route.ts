import { NextResponse } from "next/server";
import { faceAttendanceSettingsSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";
import { getFaceAttendanceSettings, normalizeFaceAttendanceSettings } from "@/lib/faceAttendance";

export async function GET(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }
  const faceAttendance = await getFaceAttendanceSettings();
  return NextResponse.json({ ok: true, faceAttendance });
}

export async function PATCH(req: Request) {
  const decodedToken = await requireAdmin(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  try {
    const input = faceAttendanceSettingsSchema.parse(await req.json());
    const faceAttendance = normalizeFaceAttendanceSettings(input);
    await adminDb()
      .collection("settings")
      .doc("school")
      .set({ faceAttendance }, { merge: true });
    return NextResponse.json({ ok: true, faceAttendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save face attendance settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
