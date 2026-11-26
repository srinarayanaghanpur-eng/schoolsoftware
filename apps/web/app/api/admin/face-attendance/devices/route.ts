import { NextResponse } from "next/server";
import { faceDeviceActionSchema, type FaceDeviceStatus } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, requireAdmin } from "@/lib/apiUtils";

export async function POST(req: Request) {
  const token = await requireAdmin(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  const tooLarge = enforceBodyLimit(req, 8192);
  if (tooLarge) return tooLarge;

  try {
    const input = faceDeviceActionSchema.parse(await req.json());
    const ref = adminDb().collection("face_devices").doc(input.deviceId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    }

    const status: FaceDeviceStatus =
      input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "revoked";
    const now = new Date().toISOString();
    await ref.set(
      {
        status,
        approvedByUid: input.action === "approve" ? token.uid : snapshot.data()?.approvedByUid,
        approvedAt: input.action === "approve" ? now : snapshot.data()?.approvedAt,
        updatedAt: now
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, deviceId: input.deviceId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the device";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
