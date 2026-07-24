import {
  employeeIdToInternalEmail,
  normalizeEmployeeId,
  type EmploymentType,
  type LateDeductionMode,
  type Teacher,
  type TeacherStatus
} from "@sri-narayana/shared";
import type { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

type TeacherProfileInput = {
  fullName: string;
  employeeId: string;
  subject: string;
  phone?: string;
  baseSalary: number;
  biometricUserId?: string;
  joiningDate?: string;
  status: TeacherStatus;
  employmentType?: EmploymentType;
  allowedCLPerMonth?: number;
  lateDeductionRule?: LateDeductionMode;
};

export function buildTeacherAuthProfile(input: TeacherProfileInput) {
  const employeeId = normalizeEmployeeId(input.employeeId);
  const employeeIdLower = employeeId.toLowerCase();

  return {
    fullName: input.fullName.trim(),
    employeeId,
    employeeIdLower,
    internalEmail: employeeIdToInternalEmail(employeeId),
    subject: input.subject.trim(),
    phone: input.phone?.trim() ?? "",
    baseSalary: Number(input.baseSalary),
    biometricUserId: input.biometricUserId?.trim() ?? "",
    joiningDate: input.joiningDate?.trim() || new Date().toISOString().slice(0, 10),
    status: input.status,
    role: "teacher" as const,
    employmentType: input.employmentType ?? "full_time",
    allowedCLPerMonth: input.allowedCLPerMonth ?? 3,
    lateDeductionRule: input.lateDeductionRule ?? "after_3_lates_one_day"
  };
}

export function makeTeacherDocumentId(employeeId: string) {
  const safeEmployeeId = normalizeEmployeeId(employeeId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `teacher_${safeEmployeeId || Date.now()}`;
}

export async function assertEmployeeIdAvailable(employeeIdLower: string, exceptTeacherId?: string) {
  const snapshot = await adminDb()
    .collection("teachers")
    .where("employeeIdLower", "==", employeeIdLower)
    .limit(1)
    .get();

  const existing = snapshot.docs[0];
  if (existing && existing.id !== exceptTeacherId) {
    throw new Error("Employee ID already exists");
  }
}

function serializeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeFirestoreValue(item)]));
}

export function serializeTeacherDoc(doc: QueryDocumentSnapshot | DocumentSnapshot): Teacher {
  return serializeFirestoreValue({ id: doc.id, ...doc.data() }) as Teacher;
}
