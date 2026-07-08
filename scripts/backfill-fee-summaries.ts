import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type EnvMap = Record<string, string>;

function loadEnvFile(filepath: string): EnvMap {
  if (!fs.existsSync(filepath)) return {};
  const content = fs.readFileSync(filepath, "utf-8");
  const env: EnvMap = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];
  let inQuotes = false;

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith("#") || (!inQuotes && line.trim() === "")) continue;

    if (inQuotes) {
      currentValue.push(line);
      if (line.endsWith('"')) {
        inQuotes = false;
        env[currentKey!] = currentValue.join("\n").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
        currentKey = null;
        currentValue = [];
      }
      continue;
    }

    const match = line.match(/^\s*([^=]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim();
    if (value.startsWith('"') && !value.endsWith('"')) {
      inQuotes = true;
      currentKey = match[1].trim();
      currentValue = [value];
    } else {
      env[match[1].trim()] = value.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    }
  }

  return env;
}

function loadLocalEnv() {
  const env = loadEnvFile(path.resolve(__dirname, "../apps/web/.env.local"));
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function getDb() {
  loadLocalEnv();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are missing in apps/web/.env.local.");
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });

  return getFirestore(app);
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function numberValue(value: unknown) {
  return Number(value) || 0;
}

function dueForStudent(student: Record<string, unknown>) {
  const totalFee = numberValue(student.totalFeeAmount) ||
    numberValue(student.committedPayableFee) +
    numberValue(student.transportFee) +
    numberValue(student.feeBalanceCarriedForward);
  const paid = numberValue(student.totalFeesPaid);
  const storedDue = numberValue(student.totalFeesDue);

  if (storedDue > 0 && totalFee > 0 && storedDue + paid <= totalFee + 1) return storedDue;
  if (storedDue > 0 && totalFee === 0) return storedDue;
  return Math.max(0, totalFee - paid);
}

async function commitBatch(db: FirebaseFirestore.Firestore, writes: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach((write) => write(batch));
    await batch.commit();
  }
}

async function main() {
  const db = getDb();
  const now = new Date();
  const studentsSnap = await db.collection("students").get();
  const summaryWrites: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  studentsSnap.docs.forEach((doc) => {
    const student = doc.data();
    const academicYearId = String(student.academicYearId || "default");
    const classId = String(student.classId || student.class || "");
    const sectionId = String(student.sectionId || student.section || "");
    const totalFee = numberValue(student.totalFeeAmount) ||
      numberValue(student.committedPayableFee) +
      numberValue(student.transportFee) +
      numberValue(student.feeBalanceCarriedForward);
    const totalPaid = numberValue(student.totalFeesPaid);
    const dueAmount = dueForStudent(student);
    const summaryRef = db.collection("studentFeeSummaries").doc(`${doc.id}_${academicYearId}`);

    summaryWrites.push((batch) => batch.set(summaryRef, {
      studentId: doc.id,
      branchId: String(student.branchId || "default-branch"),
      academicYearId: academicYearId === "default" ? "" : academicYearId,
      classId,
      sectionId,
      studentName: String(student.studentName || ""),
      admissionNumber: String(student.admissionNumber || student.admissionNo || ""),
      phone: String(student.phone || student.fatherPhone || ""),
      className: String(student.class || classId),
      sectionName: String(student.section || sectionId),
      totalFee,
      totalPaid,
      totalConcession: numberValue(student.totalConcessionAmount),
      dueAmount,
      lastPaymentDate: student.lastPaymentDate || null,
      updatedAt: now
    }, { merge: true }));
  });

  await commitBatch(db, summaryWrites);

  const paymentsSnap = await db.collection("payments").where("status", "==", "completed").get();
  const bySummary = new Map<string, { branchId: string; academicYearId: string; month: string; totalIncome: number; totalReceipts: number }>();

  paymentsSnap.docs.forEach((doc) => {
    const payment = doc.data();
    const date = asDate(payment.createdAt || payment.paymentDate || payment.date);
    if (!date) return;
    const branchId = String(payment.branchId || "default-branch");
    const academicYearId = String(payment.academicYearId || "default");
    const key = `${branchId}_${academicYearId}_${monthKey(date)}`;
    const row = bySummary.get(key) ?? { branchId, academicYearId, month: monthKey(date), totalIncome: 0, totalReceipts: 0 };
    row.totalIncome += numberValue(payment.amountPaid);
    row.totalReceipts += 1;
    bySummary.set(key, row);
  });

  const financeWrites = Array.from(bySummary.entries()).map(([id, row]) => (batch: FirebaseFirestore.WriteBatch) => {
    batch.set(db.collection("financeSummaries").doc(id), {
      branchId: row.branchId,
      academicYearId: row.academicYearId === "default" ? "" : row.academicYearId,
      month: row.month,
      totalIncome: row.totalIncome,
      totalReceipts: row.totalReceipts,
      updatedAt: now
    }, { merge: true });
  });

  await commitBatch(db, financeWrites);

  console.log(`Backfilled ${summaryWrites.length} studentFeeSummaries and ${financeWrites.length} financeSummaries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
