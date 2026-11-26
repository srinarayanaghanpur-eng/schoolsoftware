import { NextResponse } from "next/server";
import { faceDeviceRegisterSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { enforceBodyLimit } from "@/lib/apiUtils";
import { getFaceAttendanceSettings } from "@/lib/faceAttendance";
import { getSchoolId } from "@/lib/schoolScope";

function nowIso() {
  return new Date().toISOString();
}

export async function POST(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }
  const tooLarge = enforceBodyLimit(req, 8192);
  if (tooLarge) return tooLarge;

  try {
    const input = faceDeviceRegisterSchema.parse(await req.json());
    const settings = await getFaceAttendanceSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { ok: false, error: "Face attendance is switched off by the school office." },
        { status: 403 }
      );
    }

    const db = adminDb();
    const ref = db.collection("face_devices").doc(input.deviceId);
    const existing = await ref.get();
    const now = nowIso();
    const schoolId = getSchoolId(decodedToken);

    if (!existing.exists) {
      await ref.set({
        name: input.name,
        platform: input.platform,
        appVersion: input.appVersion,
        status: "pending",
        schoolId,
        requestedByUid: decodedToken.uid,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now
      });
    } else {
      const current = existing.data() as { schoolId?: string; status?: string };
      if (current.schoolId && current.schoolId !== schoolId) {
        return NextResponse.json(
          { ok: false, error: "This device is registered to another school." },
          { status: 403 }
        );
      }
      await ref.set(
        {
          name: input.name,
          platform: input.platform,
          appVersion: input.appVersion,
          lastSeenAt: now,
          updatedAt: now
        },
        { merge: true }
      );
    }

    const saved = await ref.get();
    const data = saved.data() ?? {};
    return NextResponse.json({
      ok: true,
      device: {
        id: saved.id,
        name: data.name,
        status: data.status ?? "pending",
        platform: data.platform
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register this device";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
