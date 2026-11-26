import {
  DEFAULT_SETTINGS,
  cosineSimilarity,
  type FaceAttendanceSettings,
  type FaceDevice,
  type SchoolSettings,
  type Teacher,
  type TeacherFace
} from "@sri-narayana/shared";
import { adminDb } from "./firebaseAdmin";
import { getSchoolSettings } from "./firestoreServer";

export function normalizeFaceAttendanceSettings(
  value: Partial<FaceAttendanceSettings> | undefined
): FaceAttendanceSettings {
  const fallback = DEFAULT_SETTINGS.faceAttendance ?? {
    enabled: false,
    matchThreshold: 0.6,
    requireLiveness: true,
    allowSharedDevices: true,
    allowSelfOnUnapprovedDevices: true,
    modelVersion: "mobilefacenet-192-v1"
  };
  return {
    enabled: value?.enabled === true,
    matchThreshold:
      typeof value?.matchThreshold === "number" && Number.isFinite(value.matchThreshold)
        ? Math.max(0.3, Math.min(0.99, value.matchThreshold))
        : fallback.matchThreshold,
    requireLiveness: value?.requireLiveness !== false,
    allowSharedDevices: value?.allowSharedDevices !== false,
    allowSelfOnUnapprovedDevices: value?.allowSelfOnUnapprovedDevices !== false,
    modelVersion:
      typeof value?.modelVersion === "string" && value.modelVersion.trim()
        ? value.modelVersion.trim().slice(0, 64)
        : fallback.modelVersion
  };
}

export async function getFaceAttendanceSettings(
  settings?: SchoolSettings
): Promise<FaceAttendanceSettings> {
  const resolved = settings ?? (await getSchoolSettings());
  return normalizeFaceAttendanceSettings(resolved.faceAttendance);
}

export async function getFaceDevice(deviceId: string): Promise<FaceDevice | null> {
  const snapshot = await adminDb().collection("face_devices").doc(deviceId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<FaceDevice, "id">) };
}

export async function isApprovedFaceDevice(deviceId: string): Promise<boolean> {
  if (!deviceId) return false;
  const device = await getFaceDevice(deviceId);
  return device?.status === "approved";
}

export async function getTeacherFace(teacherId: string): Promise<TeacherFace | null> {
  const snapshot = await adminDb().collection("teacher_faces").doc(teacherId).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as TeacherFace;
}

export async function getActiveTeachers(): Promise<Teacher[]> {
  const snapshot = await adminDb().collection("teachers").limit(500).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Teacher, "id">) }))
    .filter((teacher) => teacher.status === "active");
}

export async function getTeacherByUid(uid: string): Promise<Teacher | null> {
  const snapshot = await adminDb()
    .collection("teachers")
    .where("uid", "==", uid)
    .limit(1)
    .get()
    .catch(() => null);
  const doc = snapshot?.docs[0];
  return doc ? ({ id: doc.id, ...(doc.data() as Omit<Teacher, "id">) } as Teacher) : null;
}

/**
 * Compare the embedding captured on the kiosk with the stored enrollment.
 * The client also matches locally for fast UX; this server check is the
 * authoritative one so a client cannot simply name an arbitrary teacher.
 */
export function verifyFaceEmbedding(params: {
  stored: TeacherFace | null;
  observed: number[];
  modelVersion: string;
  threshold: number;
}): { ok: true; confidence: number } | { ok: false; error: string } {
  if (!params.stored) {
    return { ok: false, error: "This teacher has no enrolled face. Ask the office to enroll it." };
  }
  if (params.stored.modelVersion !== params.modelVersion) {
    return {
      ok: false,
      error: "This face enrollment uses an older model. Ask the office to re-enroll the teacher."
    };
  }
  if (params.stored.embedding.length !== params.observed.length) {
    return { ok: false, error: "Face data does not match the enrolled template." };
  }
  const confidence = cosineSimilarity(params.stored.embedding, params.observed);
  if (!Number.isFinite(confidence) || confidence < params.threshold) {
    return { ok: false, error: "Face did not match the enrolled teacher." };
  }
  return { ok: true, confidence };
}
