import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { SCHOOL_CONTACT } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";

export type ReceiptFeeItemType = "Tuition Fee" | "Transport / Bus Fee" | "Books / Uniform / Other";

export type ReceiptFeeItem = {
  type: ReceiptFeeItemType;
  periodOrMonth: string;
  amount: number;
  remarks: string;
};

export type DigitalFeeReceiptRecord = {
  id: string;
  receiptNo: string;
  receiptNumber?: string;
  paymentId: string;
  academicYear: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  section: string;
  parentName: string;
  mobile: string;
  paymentDate: string;
  paymentMode: string;
  feeItems: ReceiptFeeItem[];
  totalPaid: number;
  balanceDue: number;
  createdByUserId: string;
  createdByUsername: string;
  createdAt: string;
  printedAt?: string;
  printCount: number;
  status?: string;
};

type FirestoreRecord = Record<string, unknown>;

const DEFAULT_ACADEMIC_YEAR = "2026-27";
const FEE_ITEM_TYPES: ReceiptFeeItemType[] = [
  "Tuition Fee",
  "Transport / Bus Fee",
  "Books / Uniform / Other"
];

function isFirestoreTimestamp(value: unknown): value is { toDate: () => Date } {
  return Boolean(value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function");
}

function toIso(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (isFirestoreTimestamp(value)) return value.toDate().toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function currentAcademicYearLabel(date = new Date()) {
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function looksLikeAcademicYear(value: string) {
  return /^\d{4}-\d{2}$/.test(value.trim());
}

function counterIdForAcademicYear(academicYear: string) {
  return `SNHS_${academicYear.replace(/[^\w-]/g, "_")}`;
}

function userLabel(token?: Partial<DecodedIdToken> | null) {
  return String(token?.name || token?.email || token?.uid || "USER").trim();
}

export function paymentMethodLabel(method: unknown) {
  const normalized = String(method || "cash").toLowerCase().replace(/\s+/g, "_");
  if (normalized === "upi") return "UPI";
  if (normalized === "bank" || normalized === "bank_transfer" || normalized === "transfer") return "Bank Transfer";
  if (normalized === "cheque" || normalized === "check") return "Cheque";
  if (normalized === "card") return "Card";
  if (normalized === "cash") return "Cash";
  return "Other";
}

function feeItemType(paymentType: unknown): ReceiptFeeItemType {
  const normalized = String(paymentType || "").toLowerCase();
  if (normalized.includes("transport") || normalized.includes("bus")) return "Transport / Bus Fee";
  if (normalized.includes("book") || normalized.includes("uniform") || normalized.includes("other")) return "Books / Uniform / Other";
  return "Tuition Fee";
}

function monthLabel(value: unknown) {
  const iso = toIso(value);
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function buildFeeItems(payment: FirestoreRecord): ReceiptFeeItem[] {
  const paidType = feeItemType(payment.paymentType);
  const period = String(payment.periodOrMonth || payment.month || monthLabel(payment.paymentDate || payment.createdAt) || "");
  const remarks = String(payment.remarks || payment.note || "").trim();
  const amount = Number(payment.amountPaid || 0);
  return FEE_ITEM_TYPES.map((type) => ({
    type,
    periodOrMonth: type === paidType ? period : "",
    amount: type === paidType ? amount : 0,
    remarks: type === paidType ? remarks : ""
  }));
}

export async function resolveAcademicYearLabel(
  db: Firestore,
  academicYearId: string,
  fallback?: string,
  transaction?: Transaction
) {
  if (fallback && looksLikeAcademicYear(fallback)) return fallback;
  if (academicYearId) {
    if (looksLikeAcademicYear(academicYearId)) return academicYearId;
    const ref = db.collection("academic_years").doc(academicYearId);
    const snap = transaction ? await transaction.get(ref) : await ref.get();
    const name = String(snap.data()?.name || "").trim();
    if (looksLikeAcademicYear(name)) return name;
  }
  return currentAcademicYearLabel() || DEFAULT_ACADEMIC_YEAR;
}

export async function generateReceiptNumber(db: Firestore, academicYear: string, transaction?: Transaction) {
  const ref = db.collection("receipt_counters").doc(counterIdForAcademicYear(academicYear));
  const snap = transaction ? await transaction.get(ref) : await ref.get();
  const nextNumber = Math.max(1, Number(snap.data()?.nextNumber ?? 1));
  const receiptNo = `SNHS/${academicYear}/${String(nextNumber).padStart(4, "0")}`;
  const update = { academicYear, nextNumber: nextNumber + 1, updatedAt: new Date() };
  if (transaction) transaction.set(ref, update, { merge: true });
  else await ref.set(update, { merge: true });
  return receiptNo;
}

export function buildReceiptRecord(input: {
  receiptId: string;
  receiptNo: string;
  paymentId: string;
  academicYear: string;
  payment: FirestoreRecord;
  student: FirestoreRecord;
  createdByUserId: string;
  createdByUsername: string;
  createdAt: Date;
}) {
  const student = input.student;
  const payment = input.payment;
  const className = String(student.className || student.class || payment.className || payment.classId || payment.class || "");
  const section = String(student.sectionName || student.section || payment.sectionName || payment.sectionId || payment.section || "");
  const parentName = String(student.parentName || student.fatherName || student.motherName || student.guardianName || "");
  const mobile = String(student.parentMobile || student.fatherPhone || student.phone || student.motherPhone || "");
  const totalPaid = Number(payment.amountPaid || 0);
  const balanceDue = Math.max(0, Number(payment.remainingAmount ?? student.totalFeesDue ?? 0));

  return {
    receiptNo: input.receiptNo,
    receiptNumber: input.receiptNo,
    paymentId: input.paymentId,
    academicYear: input.academicYear,
    studentId: String(payment.studentId || student.id || ""),
    studentName: String(student.studentName || payment.studentName || ""),
    admissionNo: String(student.admissionNumber || payment.admissionNumber || ""),
    className,
    section,
    parentName,
    mobile,
    paymentDate: toIso(payment.paymentDate || payment.createdAt || input.createdAt),
    paymentMode: paymentMethodLabel(payment.paymentMethod),
    feeItems: buildFeeItems(payment),
    totalPaid,
    balanceDue,
    createdByUserId: input.createdByUserId,
    createdByUsername: input.createdByUsername,
    createdAt: input.createdAt,
    printedAt: null,
    printCount: 0,
    status: "issued"
  };
}

function normalizeReceipt(id: string, data: FirestoreRecord): DigitalFeeReceiptRecord {
  const feeItems = Array.isArray(data.feeItems) ? data.feeItems as ReceiptFeeItem[] : buildFeeItems({
    paymentType: data.paymentType,
    amountPaid: data.amountPaid || data.totalPaid,
    paymentDate: data.paymentDate || data.createdAt,
    remarks: data.remarks
  });

  return {
    id,
    receiptNo: String(data.receiptNo || data.receiptNumber || id),
    receiptNumber: String(data.receiptNumber || data.receiptNo || id),
    paymentId: String(data.paymentId || ""),
    academicYear: String(data.academicYear || data.academicYearId || DEFAULT_ACADEMIC_YEAR),
    studentId: String(data.studentId || ""),
    studentName: String(data.studentName || ""),
    admissionNo: String(data.admissionNo || data.admissionNumber || ""),
    className: String(data.className || data.class || ""),
    section: String(data.section || ""),
    parentName: String(data.parentName || ""),
    mobile: String(data.mobile || data.parentMobile || ""),
    paymentDate: toIso(data.paymentDate || data.receiptDate || data.createdAt),
    paymentMode: paymentMethodLabel(data.paymentMode || data.paymentMethod),
    feeItems,
    totalPaid: Number(data.totalPaid || data.amountPaid || 0),
    balanceDue: Math.max(0, Number(data.balanceDue || data.remainingAmount || 0)),
    createdByUserId: String(data.createdByUserId || data.issuedBy || data.createdBy || ""),
    createdByUsername: String(data.createdByUsername || data.issuedByName || "USER"),
    createdAt: toIso(data.createdAt),
    printedAt: data.printedAt ? toIso(data.printedAt) : undefined,
    printCount: Number(data.printCount || 0),
    status: String(data.status || "issued")
  };
}

export async function getReceiptById(receiptId: string) {
  const db = adminDb();
  const byId = await db.collection("receipts").doc(receiptId).get();
  if (byId.exists) return normalizeReceipt(byId.id, byId.data() as FirestoreRecord);

  const byPayment = await db.collection("receipts").where("paymentId", "==", receiptId).limit(1).get();
  if (!byPayment.empty) {
    const doc = byPayment.docs[0];
    return normalizeReceipt(doc.id, doc.data() as FirestoreRecord);
  }

  return null;
}

export async function getReceiptByPaymentId(paymentId: string) {
  const receipt = await getReceiptById(paymentId);
  if (receipt?.paymentId === paymentId || receipt?.id === paymentId) return receipt;
  return null;
}

export async function getReceiptsByStudent(studentId: string, pageSize = 25) {
  const snap = await adminDb().collection("receipts").where("studentId", "==", studentId).limit(Math.min(pageSize, 100)).get();
  return snap.docs
    .map((doc) => normalizeReceipt(doc.id, doc.data() as FirestoreRecord))
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate));
}

export async function createReceiptFromPayment(paymentId: string, token?: Partial<DecodedIdToken> | null) {
  const existing = await getReceiptByPaymentId(paymentId);
  if (existing) return existing;

  const db = adminDb();
  const receiptRef = db.collection("receipts").doc();
  let createdId = receiptRef.id;

  await db.runTransaction(async (transaction) => {
    const paymentRef = db.collection("payments").doc(paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists) throw new Error("Payment not found");
    const payment = paymentSnap.data() as FirestoreRecord;
    const studentRef = db.collection("students").doc(String(payment.studentId || ""));
    const studentSnap = await transaction.get(studentRef);
    if (!studentSnap.exists) throw new Error("Student not found");
    const student = studentSnap.data() as FirestoreRecord;
    const academicYear = await resolveAcademicYearLabel(db, String(payment.academicYearId || ""), String(payment.academicYear || ""), transaction);
    const receiptNo = await generateReceiptNumber(db, academicYear, transaction);
    const now = new Date();
    const receiptData = buildReceiptRecord({
      receiptId: receiptRef.id,
      receiptNo,
      paymentId,
      academicYear,
      payment,
      student,
      createdByUserId: String(token?.uid || payment.recordedBy || payment.paidBy || ""),
      createdByUsername: userLabel(token) || String(payment.paidByName || ""),
      createdAt: now
    });

    transaction.set(receiptRef, receiptData);
    transaction.set(paymentRef, { receiptId: receiptRef.id, receiptNumber: receiptNo, updatedAt: now }, { merge: true });
  });

  const created = await getReceiptById(createdId);
  if (!created) throw new Error("Receipt was not created");
  return created;
}

export async function markReceiptPrinted(receiptId: string, token?: Partial<DecodedIdToken> | null) {
  const receipt = await getReceiptById(receiptId);
  if (!receipt) throw new Error("Receipt not found");
  const ref = adminDb().collection("receipts").doc(receipt.id);
  await ref.set({
    printedAt: new Date(),
    printCount: FieldValue.increment(1),
    lastPrintedByUserId: token?.uid || "",
    lastPrintedByUsername: userLabel(token)
  }, { merge: true });
  const updated = await getReceiptById(receipt.id);
  if (!updated) throw new Error("Receipt not found");
  return updated;
}

export function schoolReceiptHeader() {
  return {
    schoolName: SCHOOL_CONTACT.name,
    address: "Ghanpur (M), Jayashankar Bhupalpally District",
    phone: SCHOOL_CONTACT.phone
  };
}
