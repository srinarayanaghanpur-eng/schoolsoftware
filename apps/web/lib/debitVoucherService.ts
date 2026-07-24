import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import {
  debitVoucherCreateSchema,
  type DebitVoucher,
  type ExpenseStatus,
  type FinancePaymentMethod
} from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";

const DEBIT_VOUCHERS_COLLECTION = "debitVouchers";
const EXPENSES_COLLECTION = "expenses";
const COUNTERS_COLLECTION = "counters";
const BANK_ACCOUNTS_COLLECTION = "bank_accounts";
const BANK_TRANSACTIONS_COLLECTION = "bank_transactions";
const FIRST_DEBIT_VOUCHER_NO = 3401;

type DebitVoucherCreateInput = {
  date: string;
  paidTo?: string;
  vendor?: string;
  towards?: string;
  description?: string;
  expenseCategory?: string;
  category?: string;
  amount: number;
  paymentMode?: FinancePaymentMethod;
  paymentMethod?: FinancePaymentMethod;
  notes?: string;
  academicYearId?: string;
  academicYear?: string;
  cashAccountId?: string;
  bankAccountId?: string;
};

type CreateOptions = {
  expenseStatus?: ExpenseStatus;
};

type ListDebitVoucherParams = {
  ids?: string[];
  voucherNo?: string | number | null;
  date?: string | null;
  paidTo?: string | null;
  category?: string | null;
  amount?: string | number | null;
  academicYear?: string | null;
  limit?: string | number | null;
  cursor?: string | number | null;
};

function normalizeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeFirestoreValue(item)])
  );
}

function serializeSnapshot<T extends object>(doc: FirebaseFirestore.DocumentSnapshot): T & { id: string } {
  return {
    id: doc.id,
    ...(normalizeFirestoreValue(doc.data() ?? {}) as T)
  };
}

function sanitizeIdPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "default";
}

function currentAcademicYearForDate(dateValue: string): string {
  const date = dateValue ? new Date(`${dateValue.slice(0, 10)}T00:00:00`) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const month = Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

async function resolveAcademicYear(input: { academicYear?: string; academicYearId?: string; date: string }) {
  const db = adminDb();
  const explicitYear = input.academicYear?.trim();
  if (explicitYear) return { academicYear: explicitYear, academicYearId: input.academicYearId?.trim() ?? "" };

  const academicYearId = input.academicYearId?.trim();
  if (academicYearId) {
    const yearSnap = await db.collection("academic_years").doc(academicYearId).get();
    const name = String(yearSnap.data()?.name ?? "").trim();
    if (name) return { academicYear: name, academicYearId };
  }

  const activeSnap = await db.collection("academic_years").where("isActive", "==", true).limit(1).get();
  const active = activeSnap.docs[0];
  if (active) {
    const name = String(active.data().name ?? "").trim();
    if (name) return { academicYear: name, academicYearId: active.id };
  }

  return { academicYear: currentAcademicYearForDate(input.date), academicYearId: academicYearId ?? "" };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      parts.push([TENS[ten], ONES[one]].filter(Boolean).join(" "));
    }
  }
  return parts.join(" ");
}

function integerToIndianWords(value: number): string {
  if (value === 0) return "Zero";
  const units: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"]
  ];
  let remaining = value;
  const parts: string[] = [];

  for (const [size, label] of units) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${integerToIndianWords(count)} ${label}`);
      remaining %= size;
    }
  }

  if (remaining > 0) parts.push(wordsBelowThousand(remaining));
  return parts.join(" ");
}

export function numberToIndianWords(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rupees = Math.floor(safeAmount);
  const paise = Math.round((safeAmount - rupees) * 100);
  const rupeeWords = `${integerToIndianWords(rupees)} Rupees`;
  if (paise > 0) return `${rupeeWords} and ${integerToIndianWords(paise)} Paise Only`;
  return `${rupeeWords} Only`;
}

async function readNextDebitVoucherNoInTransaction(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  academicYear: string
) {
  const counterId = `debitVoucher_${sanitizeIdPart(academicYear)}`;
  const counterRef = db.collection(COUNTERS_COLLECTION).doc(counterId);
  const counterSnap = await transaction.get(counterRef);

  let nextNo = FIRST_DEBIT_VOUCHER_NO;
  if (counterSnap.exists) {
    nextNo = Number(counterSnap.data()?.lastVoucherNo ?? FIRST_DEBIT_VOUCHER_NO - 1) + 1;
  } else {
    const latestSnap = await transaction.get(
      db
        .collection(DEBIT_VOUCHERS_COLLECTION)
        .where("academicYear", "==", academicYear)
        .orderBy("voucherNo", "desc")
        .limit(1)
    );
    const latestNo = Number(latestSnap.docs[0]?.data()?.voucherNo ?? FIRST_DEBIT_VOUCHER_NO - 1);
    nextNo = Math.max(latestNo + 1, FIRST_DEBIT_VOUCHER_NO);
  }

  return { counterRef, nextNo };
}

function writeDebitVoucherCounter(
  transaction: FirebaseFirestore.Transaction,
  counter: Awaited<ReturnType<typeof readNextDebitVoucherNoInTransaction>>,
  academicYear: string
) {
  transaction.set(
    counter.counterRef,
    {
      type: "debitVoucher",
      academicYear,
      lastVoucherNo: counter.nextNo,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function generateDebitVoucherNo(academicYear: string): Promise<number> {
  const year = academicYear.trim();
  if (!year) throw new Error("Academic year is required");
  const db = adminDb();
  return db.runTransaction(async (transaction) => {
    const counter = await readNextDebitVoucherNoInTransaction(transaction, db, year);
    writeDebitVoucherCounter(transaction, counter, year);
    return counter.nextNo;
  });
}

function normalizeVoucherInput(input: DebitVoucherCreateInput) {
  const paidTo = input.paidTo ?? input.vendor ?? "";
  const towards = input.towards ?? input.description ?? "";
  const expenseCategory = input.expenseCategory ?? input.category ?? "";
  const paymentMode = input.paymentMode ?? input.paymentMethod ?? "cash";

  return debitVoucherCreateSchema.parse({
    date: input.date,
    paidTo,
    towards,
    expenseCategory,
    amount: input.amount,
    paymentMode,
    notes: input.notes ?? "",
    academicYearId: input.academicYearId ?? "",
    academicYear: input.academicYear ?? "",
    cashAccountId: input.cashAccountId ?? "",
    bankAccountId: input.bankAccountId ?? ""
  });
}

function createdByName(token: DecodedIdToken) {
  return String(token.name || token.email || token.uid);
}

function voucherDocId(academicYear: string, voucherNo: number) {
  return `${sanitizeIdPart(academicYear)}_${voucherNo}`;
}

export async function createDebitVoucherFromExpense(
  input: DebitVoucherCreateInput,
  token: DecodedIdToken,
  options: CreateOptions = {}
) {
  const parsed = normalizeVoucherInput(input);
  const { academicYear, academicYearId } = await resolveAcademicYear(parsed);
  const db = adminDb();
  const expenseStatus = options.expenseStatus ?? "approved";

  return db.runTransaction(async (transaction) => {
    const counter = await readNextDebitVoucherNoInTransaction(transaction, db, academicYear);
    const voucherNo = counter.nextNo;
    const voucherRef = db.collection(DEBIT_VOUCHERS_COLLECTION).doc(voucherDocId(academicYear, voucherNo));
    const existingVoucherSnap = await transaction.get(voucherRef);
    if (existingVoucherSnap.exists) {
      throw new Error(`Debit voucher number ${voucherNo} already exists for ${academicYear}`);
    }

    const expenseRef = db.collection(EXPENSES_COLLECTION).doc();
    const needsBankLedger = parsed.paymentMode !== "cash" && Boolean(parsed.bankAccountId);
    const bankAccountRef = needsBankLedger ? db.collection(BANK_ACCOUNTS_COLLECTION).doc(parsed.bankAccountId) : null;
    const bankAccountSnap = bankAccountRef ? await transaction.get(bankAccountRef) : null;
    if (bankAccountRef && !bankAccountSnap?.exists) {
      throw new Error("Selected bank account was not found");
    }

    const now = FieldValue.serverTimestamp();
    const amountInWords = numberToIndianWords(parsed.amount);
    const bankTxnRef = bankAccountRef ? db.collection(BANK_TRANSACTIONS_COLLECTION).doc() : null;
    const commonAudit = {
      createdByUserId: token.uid,
      createdByUsername: createdByName(token)
    };

    writeDebitVoucherCounter(transaction, counter, academicYear);

    transaction.set(expenseRef, {
      category: parsed.expenseCategory,
      amount: parsed.amount,
      date: parsed.date,
      description: parsed.towards,
      vendor: parsed.paidTo,
      paymentMethod: parsed.paymentMode,
      status: expenseStatus,
      approvedBy: expenseStatus === "approved" ? token.uid : "",
      academicYearId,
      voucherId: voucherRef.id,
      voucherNo,
      notes: parsed.notes,
      transactionType: "expense",
      voucherType: "debit_voucher",
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });

    if (bankAccountRef && bankAccountSnap) {
      const currentBalance = Number(bankAccountSnap.data()?.currentBalance ?? 0);
      transaction.update(bankAccountRef, {
        currentBalance: currentBalance - parsed.amount,
        updatedAt: now
      });
      transaction.set(bankTxnRef!, {
        accountId: parsed.bankAccountId,
        type: "withdrawal",
        amount: parsed.amount,
        date: parsed.date,
        description: `Debit Voucher ${voucherNo} - ${parsed.towards}`,
        voucherId: voucherRef.id,
        voucherNo,
        expenseId: expenseRef.id,
        createdBy: token.uid,
        createdAt: now
      });
    }

    transaction.set(voucherRef, {
      voucherNo,
      voucherKey: `${academicYear}__${voucherNo}`,
      academicYear,
      academicYearId,
      date: parsed.date,
      paidTo: parsed.paidTo,
      paidToLower: parsed.paidTo.toLowerCase(),
      towards: parsed.towards,
      amount: parsed.amount,
      amountInWords,
      expenseCategory: parsed.expenseCategory,
      paymentMode: parsed.paymentMode,
      cashAccountId: parsed.cashAccountId,
      bankAccountId: parsed.bankAccountId,
      expenseId: expenseRef.id,
      bankTransactionId: bankTxnRef?.id ?? "",
      notes: parsed.notes,
      transactionType: "expense",
      voucherType: "debit_voucher",
      ...commonAudit,
      createdAt: now,
      printedAt: null,
      printCount: 0,
      status: "active"
    });

    return {
      voucherId: voucherRef.id,
      expenseId: expenseRef.id,
      voucherNo,
      academicYear,
      amountInWords,
      bankTransactionId: bankTxnRef?.id ?? ""
    };
  });
}

export async function getDebitVoucher(id: string): Promise<DebitVoucher | null> {
  const snap = await adminDb().collection(DEBIT_VOUCHERS_COLLECTION).doc(id).get();
  return snap.exists ? serializeSnapshot<DebitVoucher>(snap) : null;
}

export async function listDebitVouchers(params: ListDebitVoucherParams = {}) {
  const db = adminDb();
  const limit = Math.min(Math.max(Number(params.limit ?? 25) || 25, 1), 100);

  if (params.ids?.length) {
    const uniqueIds = Array.from(new Set(params.ids.filter(Boolean))).slice(0, 100);
    if (!uniqueIds.length) return { vouchers: [] as DebitVoucher[], nextCursor: "" };
    const snaps = await db.getAll(...uniqueIds.map((id) => db.collection(DEBIT_VOUCHERS_COLLECTION).doc(id)));
    const vouchers = snaps
      .filter((snap) => snap.exists)
      .map((snap) => serializeSnapshot<DebitVoucher>(snap))
      .sort((a, b) => a.voucherNo - b.voucherNo);
    return { vouchers, nextCursor: "" };
  }

  let query: FirebaseFirestore.Query = db.collection(DEBIT_VOUCHERS_COLLECTION);
  const voucherNo = Number(params.voucherNo);
  const amount = Number(params.amount);
  const paidTo = String(params.paidTo ?? "").trim().toLowerCase();
  const date = String(params.date ?? "").trim();
  const category = String(params.category ?? "").trim();
  const academicYear = String(params.academicYear ?? "").trim();

  if (Number.isFinite(voucherNo) && voucherNo > 0) {
    query = query.where("voucherNo", "==", voucherNo).limit(limit);
  } else if (paidTo) {
    query = query
      .where("paidToLower", ">=", paidTo)
      .where("paidToLower", "<=", `${paidTo}\uf8ff`)
      .orderBy("paidToLower", "asc")
      .limit(limit);
  } else if (date) {
    query = query.where("date", "==", date).orderBy("voucherNo", "desc").limit(limit);
  } else if (category) {
    query = query.where("expenseCategory", "==", category).orderBy("voucherNo", "desc").limit(limit);
  } else if (Number.isFinite(amount) && amount > 0) {
    query = query.where("amount", "==", amount).orderBy("voucherNo", "desc").limit(limit);
  } else {
    if (academicYear) query = query.where("academicYear", "==", academicYear);
    query = query.orderBy("voucherNo", "desc");
    const cursor = Number(params.cursor);
    if (Number.isFinite(cursor) && cursor > 0) query = query.startAfter(cursor);
    query = query.limit(limit);
  }

  const snap = await query.get();
  const vouchers = snap.docs.map((doc) => serializeSnapshot<DebitVoucher>(doc));
  const last = vouchers[vouchers.length - 1];
  const nextCursor = !params.voucherNo && !paidTo && !date && !category && !(Number.isFinite(amount) && amount > 0) && vouchers.length === limit
    ? String(last?.voucherNo ?? "")
    : "";

  return { vouchers, nextCursor };
}

export async function markDebitVouchersPrinted(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 100);
  if (!uniqueIds.length) return;
  const db = adminDb();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  uniqueIds.forEach((id) => {
    batch.update(db.collection(DEBIT_VOUCHERS_COLLECTION).doc(id), {
      printedAt: now,
      printCount: FieldValue.increment(1)
    });
  });
  await batch.commit();
}

export async function getDebitVouchersByIds(ids: string[]) {
  const { vouchers } = await listDebitVouchers({ ids });
  return vouchers;
}

export async function getDebitVoucherByVoucherNo(voucherNo: number) {
  const snap = await adminDb()
    .collection(DEBIT_VOUCHERS_COLLECTION)
    .where("voucherNo", "==", voucherNo)
    .orderBy(FieldPath.documentId())
    .limit(1)
    .get();
  return snap.docs[0] ? serializeSnapshot<DebitVoucher>(snap.docs[0]) : null;
}
