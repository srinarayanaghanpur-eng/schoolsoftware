import {
  DEFAULT_SETTINGS,
  findHolidayForDate,
  type AttendanceRecord,
  type Holiday,
  type SchoolSettings,
  type Teacher
} from "@sri-narayana/shared";
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

/** Active holiday declared for a date (YYYY-MM-DD), or null. */
export async function getHolidayByDate(date: string, branchId?: string): Promise<Holiday | null> {
  const dateKey = date.slice(0, 10);
  const snapshot = await adminDb().collection("holidays").where("date", "==", dateKey).get();
  const holidays = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Holiday));
  return findHolidayForDate(holidays, dateKey, branchId) ?? null;
}

export async function isHolidayDate(date: string, branchId?: string): Promise<boolean> {
  return Boolean(await getHolidayByDate(date, branchId));
}
