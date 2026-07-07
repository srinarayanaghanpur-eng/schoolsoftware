import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

type FeeTypeDue = {
  id: string;
  feeType: string;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  dueDate: string | null;
};

type ReminderStudent = {
  id: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  parentName: string;
  parentMobile: string;
  className: string;
  sectionName: string;
  totalDue: number;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  lastPaymentDate: string | null;
};

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function amount(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeKey(value: unknown): string {
  return asString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameFeeType(headName: string, paymentType: string): boolean {
  const head = normalizeKey(headName);
  const payment = normalizeKey(paymentType);
  if (!head || !payment) return false;
  if (head === payment || head.includes(payment) || payment.includes(head)) return true;

  const groups = [
    ["tuition", "tuitionfee", "academicfee", "annualfee", "annualenrollment", "annualenrollmentfee"],
    ["transport", "transportfee", "bus", "busfee"],
    ["books", "book", "booksfee", "uniform", "booksuniformother"],
    ["exam", "examfee"],
    ["commitment", "commitmentfee"],
    ["other", "otherfee", "misc", "miscellaneous"]
  ];
  return groups.some((group) => group.includes(head) && group.includes(payment));
}

function studentFromSummary(
  summaryDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  studentData: FirebaseFirestore.DocumentData = {}
): ReminderStudent {
  const summary = summaryDoc.data() ?? {};
  const studentId = asString(summary.studentId || summaryDoc.id.split("_")[0] || summaryDoc.id);
  const totalFee = amount(summary.totalFee || studentData.totalFeeAmount);
  const paidAmount = amount(summary.totalPaid || studentData.totalFeesPaid);
  const concessionAmount = amount(summary.totalConcession || studentData.totalConcessionAmount);
  const className = asString(summary.className || summary.classId || studentData.class || studentData.classId);
  const sectionName = asString(summary.sectionName || summary.sectionId || studentData.section || studentData.sectionId);

  return {
    id: studentId,
    studentName: asString(summary.studentName || studentData.studentName),
    admissionNumber: asString(summary.admissionNumber || studentData.admissionNumber || studentData.admissionNo),
    rollNumber: asString(summary.rollNumber || summary.rollNo || studentData.rollNumber || studentData.rollNo),
    parentName: asString(summary.parentName || studentData.parentName || studentData.fatherName || studentData.motherName || studentData.guardianName),
    parentMobile: asString(summary.parentMobile || summary.phone || studentData.parentMobile || studentData.phone || studentData.fatherPhone || studentData.motherPhone),
    className,
    sectionName,
    totalDue: amount(summary.dueAmount || studentData.totalFeesDue),
    totalFee,
    paidAmount,
    concessionAmount,
    lastPaymentDate: toDateString(summary.lastPaymentDate || studentData.lastPaymentDate)
  };
}

function classKeyFor(student: ReminderStudent): string {
  return normalizeKey(student.className) || "unknown";
}

async function getStudentDocs(
  db: FirebaseFirestore.Firestore,
  studentIds: string[]
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const studentById = new Map<string, FirebaseFirestore.DocumentData>();
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  for (let i = 0; i < uniqueIds.length; i += 30) {
    const refs = uniqueIds.slice(i, i + 30).map((id) => db.collection("students").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) studentById.set(snap.id, snap.data() ?? {});
    });
  }
  return studentById;
}

async function getSummaryDoc(
  db: FirebaseFirestore.Firestore,
  studentId: string,
  academicYearId: string,
  schoolId: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  if (academicYearId) {
    const direct = await db.collection("studentFeeSummaries").doc(`${studentId}_${academicYearId}`).get();
    if (direct.exists) return direct;
  }

  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries").where("studentId", "==", studentId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  const snap = await query.limit(10).get();
  logFirestoreRead("FinanceReminderDetailAPI", "studentFeeSummaries", snap, { studentId, academicYearId, schoolId });
  return snap.docs.find((doc) => {
    const data = doc.data();
    return (!academicYearId || asString(data.academicYearId) === academicYearId)
      && (!schoolId || !data.schoolId || asString(data.schoolId) === schoolId);
  }) ?? null;
}

async function getFeeStructure(
  db: FirebaseFirestore.Firestore,
  academicYearId: string,
  className: string,
  schoolId: string
): Promise<FirebaseFirestore.DocumentData | null> {
  if (!academicYearId || !className) return null;

  const snap = await db.collection("fee_structures")
    .where("academicYearId", "==", academicYearId)
    .limit(100)
    .get();
  logFirestoreRead("FinanceReminderDetailAPI", "fee_structures", snap, { academicYearId, className, schoolId });

  const normalizedClass = normalizeKey(className);
  const match = snap.docs.find((doc) => {
    const data = doc.data();
    return normalizeKey(data.className) === normalizedClass
      && (!schoolId || !data.schoolId || asString(data.schoolId) === schoolId);
  });
  return match?.data() ?? null;
}

async function getStudentPayments(
  db: FirebaseFirestore.Firestore,
  studentId: string,
  academicYearId: string
): Promise<FirebaseFirestore.DocumentData[]> {
  let query: FirebaseFirestore.Query = db.collection("payments").where("studentId", "==", studentId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  const snap = await query.limit(200).get();
  logFirestoreRead("FinanceReminderDetailAPI", "payments", snap, { studentId, academicYearId, pageSize: 200 });
  return snap.docs
    .map((doc) => doc.data())
    .filter((payment) => !payment.status || asString(payment.status) === "completed");
}

function buildFeeHeads(student: ReminderStudent, studentData: FirebaseFirestore.DocumentData, feeStructure: FirebaseFirestore.DocumentData | null) {
  const heads = Array.isArray(feeStructure?.heads)
    ? feeStructure.heads
      .map((head: FirebaseFirestore.DocumentData) => ({ name: asString(head.name), amount: amount(head.amount), dueDate: asString(head.dueDate || feeStructure.dueDate) || null }))
      .filter((head: { name: string; amount: number }) => head.name && head.amount > 0)
    : [];

  const hasHead = (name: string) => heads.some((head: { name: string }) => sameFeeType(head.name, name));
  const commitmentFee = amount(studentData.commitmentFee);
  const carriedForward = amount(studentData.feeBalanceCarriedForward || studentData.previousYearDues);

  if (heads.length === 0) {
    const annualFee = amount(studentData.annualEnrollmentFee);
    if (annualFee > 0) heads.push({ name: "Tuition Fee", amount: annualFee, dueDate: null });
    if (commitmentFee > 0) heads.push({ name: "Commitment Fee", amount: commitmentFee, dueDate: null });
  } else if (commitmentFee > 0 && !hasHead("commitment")) {
    heads.push({ name: "Commitment Fee", amount: commitmentFee, dueDate: null });
  }

  if (carriedForward > 0 && !hasHead("previous year dues")) {
    heads.push({ name: "Previous Year Dues", amount: carriedForward, dueDate: null });
  }

  const headTotal = heads.reduce((sum: number, head: { amount: number }) => sum + head.amount, 0);
  const remainder = Math.max(0, student.totalFee - headTotal);
  if (remainder > 0) heads.push({ name: "Other Fee", amount: remainder, dueDate: null });
  if (heads.length === 0 && student.totalDue > 0) heads.push({ name: "Other Fee", amount: Math.max(student.totalDue, student.totalFee), dueDate: null });

  return heads;
}

function buildFeeTypeDues(
  student: ReminderStudent,
  studentData: FirebaseFirestore.DocumentData,
  feeStructure: FirebaseFirestore.DocumentData | null,
  payments: FirebaseFirestore.DocumentData[]
): FeeTypeDue[] {
  const heads = buildFeeHeads(student, studentData, feeStructure);
  const matchedPaid = new Array(heads.length).fill(0) as number[];

  for (const payment of payments) {
    const paymentType = asString(payment.paymentType);
    const amountPaid = amount(payment.amountPaid || payment.amount);
    const index = heads.findIndex((head: { name: string }) => sameFeeType(head.name, paymentType));
    if (index >= 0) matchedPaid[index] += amountPaid;
  }

  const totalMatchedPaid = matchedPaid.reduce((sum, item) => sum + item, 0);
  let unallocatedPaid = Math.max(0, student.paidAmount - totalMatchedPaid);
  let unallocatedConcession = student.concessionAmount;

  const feeTypes = heads.map((head: { name: string; amount: number; dueDate: string | null }, index: number) => {
    const paidFromPool = Math.min(unallocatedPaid, Math.max(0, head.amount - matchedPaid[index]));
    unallocatedPaid -= paidFromPool;
    const paidAmount = Math.min(head.amount, matchedPaid[index] + paidFromPool);
    const concessionAmount = Math.min(unallocatedConcession, Math.max(0, head.amount - paidAmount));
    unallocatedConcession -= concessionAmount;
    const dueAmount = Math.max(0, head.amount - paidAmount - concessionAmount);

    return {
      id: `${normalizeKey(head.name) || "fee"}-${index}`,
      feeType: head.name,
      totalFee: head.amount,
      paidAmount,
      concessionAmount,
      dueAmount,
      dueDate: head.dueDate
    };
  });

  let dueTotal = feeTypes.reduce((sum, feeType) => sum + feeType.dueAmount, 0);
  if (student.totalDue > dueTotal) {
    feeTypes.push({
      id: `other-adjustment-${feeTypes.length}`,
      feeType: "Other Fee",
      totalFee: student.totalDue - dueTotal,
      paidAmount: 0,
      concessionAmount: 0,
      dueAmount: student.totalDue - dueTotal,
      dueDate: null
    });
    dueTotal = student.totalDue;
  }

  if (student.totalDue < dueTotal) {
    let excess = dueTotal - student.totalDue;
    for (let i = feeTypes.length - 1; i >= 0 && excess > 0; i -= 1) {
      const reduction = Math.min(excess, feeTypes[i].dueAmount);
      feeTypes[i].dueAmount -= reduction;
      feeTypes[i].paidAmount = Math.max(0, feeTypes[i].totalFee - feeTypes[i].concessionAmount - feeTypes[i].dueAmount);
      excess -= reduction;
    }
  }

  return feeTypes.filter((feeType) => feeType.dueAmount > 0);
}

async function buildStudentDetail(req: Request, studentId: string, academicYearId: string, schoolId: string) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const [summaryDoc, studentSnap] = await Promise.all([
    getSummaryDoc(db, studentId, academicYearId, schoolId),
    db.collection("students").doc(studentId).get()
  ]);

  if (!summaryDoc && !studentSnap.exists) {
    return NextResponse.json({ ok: false, error: "Student fee summary not found" }, { status: 404 });
  }

  const studentData = studentSnap.exists ? studentSnap.data() ?? {} : {};
  const student = summaryDoc ? studentFromSummary(summaryDoc, studentData) : studentFromSummary(studentSnap, studentData);
  const resolvedYear = academicYearId || asString((summaryDoc?.data() ?? studentData).academicYearId);
  const resolvedSchoolId = schoolId || asString((summaryDoc?.data() ?? studentData).schoolId);
  const [feeStructure, payments] = await Promise.all([
    getFeeStructure(db, resolvedYear, student.className, resolvedSchoolId),
    getStudentPayments(db, student.id, resolvedYear)
  ]);

  const feeTypes = buildFeeTypeDues(student, studentData, feeStructure, payments);

  return NextResponse.json({ ok: true, student: { ...student, feeTypes } });
}

// GET /api/admin/finance/reminders — class-wise dues and selected-student detail for manual reminders.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 500, 1000);
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || getSchoolId(token);
  const studentId = searchParams.get("studentId") || "";

  if (studentId) {
    return buildStudentDetail(req, studentId, academicYearId, schoolId);
  }

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries");
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  else if (schoolId) query = query.where("schoolId", "==", schoolId);

  const snap = await query.limit(pageSize).get();
  logFirestoreRead("FinanceRemindersAPI", "studentFeeSummaries", snap, { schoolId, academicYearId, classFilter, sectionFilter, pageSize });

  const dueDocs = snap.docs
    .filter((doc) => {
      const data = doc.data();
      const balanceDue = amount(data.dueAmount);
      const feeSt = asString(data.feeStatus || "");
      return balanceDue > 0
        && feeSt !== "paid"
        && (!schoolId || !data.schoolId || asString(data.schoolId) === schoolId)
        && (!academicYearId || asString(data.academicYearId) === academicYearId)
        && (!classFilter || asString(data.classId || data.className) === classFilter)
        && (!sectionFilter || asString(data.sectionId || data.sectionName) === sectionFilter);
    })
    .sort((left, right) => asString(left.data().className || left.data().classId).localeCompare(asString(right.data().className || right.data().classId), undefined, { numeric: true }));

  const studentById = await getStudentDocs(db, dueDocs.map((doc) => asString(doc.data().studentId || doc.id.split("_")[0])));
  const byClass = new Map<string, { key: string; classId: string; className: string; studentCount: number; totalDue: number; students: ReminderStudent[] }>();
  let grandTotalDue = 0;

  dueDocs.forEach((doc) => {
    const summary = doc.data();
    const id = asString(summary.studentId || doc.id.split("_")[0]);
    const student = studentFromSummary(doc, studentById.get(id) ?? {});
    if (student.totalDue <= 0) return;
    grandTotalDue += student.totalDue;

    const key = classKeyFor(student);
    const entry = byClass.get(key) ?? {
      key,
      classId: asString(summary.classId || student.className),
      className: student.className || "Unassigned",
      studentCount: 0,
      totalDue: 0,
      students: []
    };
    entry.studentCount += 1;
    entry.totalDue += student.totalDue;
    entry.students.push(student);
    byClass.set(key, entry);
  });

  const classes = Array.from(byClass.values())
    .map((entry) => ({
      ...entry,
      students: entry.students.sort((left, right) => left.studentName.localeCompare(right.studentName))
    }))
    .sort((left, right) => left.className.localeCompare(right.className, undefined, { numeric: true }));

  return NextResponse.json({
    ok: true,
    classes,
    grandTotalDue,
    studentsWithDues: classes.reduce((count, entry) => count + entry.studentCount, 0),
    pageSize,
    truncated: snap.size >= pageSize
  });
}

// POST /api/admin/finance/reminders — log manual reminder intent.
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const studentId = asString(body?.studentId).trim();
    const channel = body?.channel === "google_messages" ? "google_messages" : "whatsapp";
    const feeType = asString(body?.feeType || "All Pending Fees").trim();
    const dueAmount = amount(body?.dueAmount);
    const academicYearId = asString(body?.academicYearId).trim();
    const schoolId = asString(body?.schoolId || getSchoolId(token));
    const parentMobile = asString(body?.parentMobile).trim();
    const studentName = asString(body?.studentName).trim();

    if (!studentId) return NextResponse.json({ ok: false, error: "studentId is required" }, { status: 400 });
    if (!dueAmount) return NextResponse.json({ ok: false, error: "dueAmount must be greater than 0" }, { status: 400 });

    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    const ref = await db.collection("fee_reminders").add({
      studentId,
      studentName,
      parentMobile,
      feeType,
      amount: dueAmount,
      dueAmount,
      channel,
      status: "opened/manual_send_required",
      sent: false,
      manualSendRequired: true,
      academicYearId,
      schoolId,
      createdBy: token.uid,
      createdAt: now
    });

    await writeAuditLog({
      action: "fee_reminder.opened",
      entityType: "fee_reminder",
      entityId: ref.id,
      actorId: token.uid,
      actorRole: asString(token.role),
      academicYearId,
      newValues: { studentId, parentMobile, feeType, dueAmount, channel, status: "opened/manual_send_required" }
    });

    return NextResponse.json({ ok: true, id: ref.id, status: "opened/manual_send_required" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to log reminder" }, { status: 400 });
  }
}
