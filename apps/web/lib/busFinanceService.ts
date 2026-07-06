/**
 * Bus Finance — server-side helpers (Firebase Admin SDK).
 *
 * Holds the EMI schedule generation and summary recomputation logic shared by
 * the bus-finance API routes. Everything here runs server-side only.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

export const BUS_FINANCE_COLLECTION = "bus_finance";
export const BUS_EMI_PAYMENTS_COLLECTION = "bus_emi_payments";

interface ScheduleSource {
  vehicleNumber: string;
  emiAmount: number;
  totalEmis: number;
  emiDueDay: number;
  loanStartDate: string; // yyyy-mm-dd
  academicYearId?: string;
  schoolId?: string;
}

function daysInMonth(year: number, monthIndex0: number): number {
  // monthIndex0 is 0-based; day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** ISO yyyy-mm-dd for a UTC date. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the due date for EMI number `n` (1-based) given the loan start date
 * and the due day-of-month. The month advances by (n-1) from the start month;
 * the day is clamped to the length of that month (e.g. day 31 in February).
 */
export function emiDueDateFor(loanStartDate: string, dueDay: number, n: number): Date {
  const start = new Date(loanStartDate + "T00:00:00Z");
  const baseYear = start.getUTCFullYear();
  const baseMonth = start.getUTCMonth();
  const totalMonthOffset = baseMonth + (n - 1);
  const year = baseYear + Math.floor(totalMonthOffset / 12);
  const month = ((totalMonthOffset % 12) + 12) % 12;
  const day = Math.min(Math.max(1, Math.floor(dueDay) || 1), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

function emiMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Generate the monthly EMI schedule for a bus finance record. Idempotent:
 * only creates rows for EMI numbers that don't already exist, so calling it
 * again never duplicates rows. Returns how many rows were created.
 */
export async function generateEmiSchedule(financeId: string, source: ScheduleSource): Promise<number> {
  const db = adminDb();
  const existingSnap = await db
    .collection(BUS_EMI_PAYMENTS_COLLECTION)
    .where("busFinanceId", "==", financeId)
    .get();
  const existingNumbers = new Set<number>(existingSnap.docs.map((d) => Number(d.data().emiNumber)));

  const now = FieldValue.serverTimestamp();
  const today = isoDate(new Date());
  let created = 0;

  // Firestore batches cap at 500 writes; chunk to be safe.
  let batch = db.batch();
  let inBatch = 0;

  for (let n = 1; n <= source.totalEmis; n++) {
    if (existingNumbers.has(n)) continue;
    const due = emiDueDateFor(source.loanStartDate, source.emiDueDay, n);
    const dueIso = isoDate(due);
    const ref = db.collection(BUS_EMI_PAYMENTS_COLLECTION).doc();
    batch.set(ref, {
      busFinanceId: financeId,
      vehicleNumber: source.vehicleNumber,
      academicYearId: source.academicYearId || "",
      schoolId: source.schoolId || "",
      emiNumber: n,
      emiMonth: emiMonthKey(due),
      dueDate: dueIso,
      emiAmount: Number(source.emiAmount) || 0,
      paidAmount: 0,
      status: dueIso < today ? "overdue" : "pending",
      lateFee: 0,
      createdAt: now,
      updatedAt: now,
    });
    created++;
    inBatch++;
    if (inBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();
  return created;
}

/** Derive an EMI payment status from amounts + due date. */
export function derivePaymentStatus(paidAmount: number, emiAmount: number, dueDate: string): "pending" | "paid" | "partial" | "overdue" {
  const paid = Number(paidAmount) || 0;
  const amount = Number(emiAmount) || 0;
  if (paid >= amount && amount > 0) return "paid";
  if (paid > 0) return "partial";
  const today = isoDate(new Date());
  if (dueDate && dueDate < today) return "overdue";
  return "pending";
}

/**
 * Recompute the parent bus_finance summary from its EMI payment rows:
 * paidEmis, pendingEmis, and status. Also flips overdue/pending statuses on
 * unpaid rows whose due date has passed. Preserves a manual "cancelled" status.
 */
export async function recalcFinanceSummary(financeId: string): Promise<void> {
  const db = adminDb();
  const financeRef = db.collection(BUS_FINANCE_COLLECTION).doc(financeId);
  const [financeSnap, paymentsSnap] = await Promise.all([
    financeRef.get(),
    db.collection(BUS_EMI_PAYMENTS_COLLECTION).where("busFinanceId", "==", financeId).get(),
  ]);
  if (!financeSnap.exists) return;

  const finance = financeSnap.data() as Record<string, unknown>;
  const today = isoDate(new Date());

  let paidEmis = 0;
  let hasOverdue = false;

  // Refresh stale overdue/pending flags on unpaid rows (write-back, batched).
  let batch = db.batch();
  let inBatch = 0;
  for (const doc of paymentsSnap.docs) {
    const p = doc.data();
    const status = String(p.status);
    if (status === "paid") {
      paidEmis++;
      continue;
    }
    const paidAmount = Number(p.paidAmount) || 0;
    const desired = derivePaymentStatus(paidAmount, Number(p.emiAmount) || 0, String(p.dueDate));
    if (desired === "overdue") hasOverdue = true;
    if (desired !== status) {
      batch.update(doc.ref, { status: desired, updatedAt: FieldValue.serverTimestamp() });
      inBatch++;
      if (inBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
  }
  if (inBatch > 0) await batch.commit();

  const totalEmis = Number(finance.totalEmis) || paymentsSnap.size;
  const pendingEmis = Math.max(0, totalEmis - paidEmis);

  let status = String(finance.status || "active");
  if (status !== "cancelled") {
    if (pendingEmis === 0 && totalEmis > 0) status = "closed";
    else if (hasOverdue) status = "overdue";
    else status = "active";
  }

  await financeRef.update({
    paidEmis,
    pendingEmis,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
