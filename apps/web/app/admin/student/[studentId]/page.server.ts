"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { resolveFeeState } from "@/lib/feeModel";
import { getReceiptsByStudent } from "@/lib/receiptService";
import { writeAuditLog } from "@/lib/auditLog";

export type StudentProfileData = {
  student: Record<string, unknown> | null;
  feeSummary: {
    originalFee: number;
    payableFee: number;
    concession: number;
    paid: number;
    due: number;
    status: "paid" | "partial" | "pending";
  } | null;
  payments: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  certificates: Record<string, unknown>[];
  examMarks: Record<string, unknown>[];
};

function toPlain(value: unknown): unknown {
  if (value && typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

export async function getStudentProfile(studentId: string): Promise<StudentProfileData> {
  const db = adminDb();

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) {
    return { student: null, feeSummary: null, payments: [], receipts: [], auditLogs: [], certificates: [], examMarks: [] };
  }
  const student = { id: studentSnap.id, ...(studentSnap.data() as Record<string, unknown>) } as Record<string, unknown>;

  const fee = resolveFeeState(student as Record<string, unknown>);

  const paymentsSnap = await db.collection("payments")
    .where("studentId", "==", studentId)
    .where("status", "==", "completed")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...(toPlain(d.data()) as Record<string, unknown>) }));

  const receipts = await getReceiptsByStudent(studentId, 50);

  const certsSnap = await db.collection("certificates")
    .where("studentId", "==", studentId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const certificates = certsSnap.docs.map((d) => ({ id: d.id, ...(toPlain(d.data()) as Record<string, unknown>) }));

  const className = String(student.class || "");
  const section = String(student.section || "");
  const examsSnap = await db.collection("exams")
    .where("className", "==", className)
    .limit(20)
    .get();
  const examMarks: Record<string, unknown>[] = [];
  for (const examDoc of examsSnap.docs) {
    const exam = examDoc.data() as Record<string, unknown>;
    const marksSnap = await db.collection("exams").doc(examDoc.id).collection("marks")
      .where("studentId", "==", studentId)
      .limit(10)
      .get();
    marksSnap.docs.forEach((m) => {
      examMarks.push({
        id: m.id,
        examId: examDoc.id,
        examName: String(exam.name || ""),
        examType: String(exam.examType || ""),
        className: String(exam.className || ""),
        section: String(exam.section || ""),
        ...((toPlain(m.data()) ?? {}) as Record<string, unknown>)
      });
    });
  }

  const logsSnap = await db.collection("audit_logs")
    .where("entityType", "==", "student")
    .where("entityId", "==", studentId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const auditLogs = logsSnap.docs.map((d) => ({ id: d.id, ...(toPlain(d.data()) as Record<string, unknown>) }));

  return {
    student,
    feeSummary: {
      originalFee: fee.originalFee,
      payableFee: fee.payableFee,
      concession: fee.concession,
      paid: fee.paid,
      due: fee.due,
      status: fee.status
    },
    payments,
    receipts: receipts as Record<string, unknown>[],
    auditLogs,
    certificates,
    examMarks
  };
}

export async function getStudentById(studentId: string) {
  const db = adminDb();
  const snap = await db.collection("students").doc(studentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

export async function recordAuditAction(params: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  academicYearId?: string;
}) {
  return writeAuditLog({
    action: params.action as any,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    oldValues: params.oldValues,
    newValues: params.newValues,
    reason: params.reason,
    academicYearId: params.academicYearId
  });
}
