import { DEFAULT_SETTINGS, type AttendanceRecord, type SchoolSettings, type Teacher } from "@sri-narayana/shared";
import { adminDb } from "./firebaseAdmin";

export async function getSchoolSettings(): Promise<SchoolSettings> {
  const snapshot = await adminDb().collection("settings").doc("school").get();
  const settings = snapshot.exists ? ({ ...DEFAULT_SETTINGS, ...snapshot.data() } as SchoolSettings) : DEFAULT_SETTINGS;
  return {
    ...settings,
    biometricApiSecret: settings.biometricApiSecret ?? process.env.BIOMETRIC_API_SECRET
  };
}

export async function getTeacherById(teacherId: string) {
  const snapshot = await adminDb().collection("teachers").doc(teacherId).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as Teacher) : null;
}

export async function getTeacherByBiometricUserId(biometricUserId: string) {
  const snapshot = await adminDb()
    .collection("teachers")
    .where("biometricUserId", "==", biometricUserId)
    .where("status", "==", "active")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as Teacher) : null;
}

export async function getAttendanceRecord(documentId: string) {
  const snapshot = await adminDb().collection("attendance").doc(documentId).get();
  return snapshot.exists ? (snapshot.data() as AttendanceRecord) : undefined;
}
