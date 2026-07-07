import { NextResponse } from "next/server";
import { FieldValue, type WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";

type GpsUpdateMode = "teacher" | "all";

function toFiniteNumber(value: unknown, label: string) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return numberValue;
}

function validateGpsPayload(body: Record<string, unknown>) {
  const mode = body.mode === "all" ? "all" : "teacher";
  const teacherId = typeof body.teacherId === "string" ? body.teacherId.trim() : "";
  const gpsEnabled = typeof body.gpsEnabled === "boolean" ? body.gpsEnabled : true;
  const gpsLatitude = toFiniteNumber(body.gpsLatitude, "Latitude");
  const gpsLongitude = toFiniteNumber(body.gpsLongitude, "Longitude");
  const gpsRadiusMeters = toFiniteNumber(body.gpsRadiusMeters, "Allowed radius");

  if (mode === "teacher" && !teacherId) {
    throw new Error("Select a teacher before saving GPS settings.");
  }
  if (gpsLatitude < -90 || gpsLatitude > 90) {
    throw new Error("Latitude should be between -90 and 90.");
  }
  if (gpsLongitude < -180 || gpsLongitude > 180) {
    throw new Error("Longitude should be between -180 and 180.");
  }
  if (gpsRadiusMeters < 10 || gpsRadiusMeters > 5000) {
    throw new Error("Allowed radius should be between 10 and 5000 meters.");
  }

  return {
    mode: mode as GpsUpdateMode,
    teacherId,
    gpsEnabled,
    gpsLatitude,
    gpsLongitude,
    gpsRadiusMeters
  };
}

async function commitBatch(batch: WriteBatch, operationCount: number) {
  if (operationCount > 0) {
    await batch.commit();
  }
}

export async function PATCH(request: Request) {
  try {
    const decodedToken = await requireAdmin(request);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const payload = validateGpsPayload(await request.json());
    const db = adminDb();
    const timestamp = FieldValue.serverTimestamp();
    const update = {
      gpsEnabled: payload.gpsEnabled,
      gpsLatitude: payload.gpsLatitude,
      gpsLongitude: payload.gpsLongitude,
      gpsRadiusMeters: payload.gpsRadiusMeters,
      gpsUpdatedAt: timestamp,
      gpsUpdatedBy: decodedToken.uid
    };

    if (payload.mode === "teacher") {
      const teacherRef = db.collection("teachers").doc(payload.teacherId);
      const teacherSnapshot = await teacherRef.get();
      if (!teacherSnapshot.exists) {
        return NextResponse.json({ ok: false, error: "Teacher not found" }, { status: 404 });
      }

      await teacherRef.set(update, { merge: true });
      return NextResponse.json({
        ok: true,
        updatedCount: 1,
        message: "Selected teacher GPS settings updated."
      });
    }

    const snapshot = await db.collection("teachers").limit(1000).get();
    let batch = db.batch();
    let operationCount = 0;
    let updatedCount = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.set(docSnapshot.ref, update, { merge: true });
      operationCount += 1;
      updatedCount += 1;

      if (operationCount === 450) {
        await commitBatch(batch, operationCount);
        batch = db.batch();
        operationCount = 0;
      }
    }

    await commitBatch(batch, operationCount);

    return NextResponse.json({
      ok: true,
      updatedCount,
      message: `GPS settings updated for ${updatedCount} teacher${updatedCount === 1 ? "" : "s"}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update GPS settings.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
