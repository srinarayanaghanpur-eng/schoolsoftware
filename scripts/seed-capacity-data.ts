import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type EnvMap = Record<string, string>;

const RUN_ID = process.env.LOADTEST_RUN_ID || "capacity-test";
const STUDENT_COUNT = readCount("LOADTEST_STUDENTS", 500);
const TEACHER_COUNT = readCount("LOADTEST_TEACHERS", 20);
const DRIVER_COUNT = readCount("LOADTEST_DRIVERS", 10);
const RECEIPT_COUNT = readCount("LOADTEST_RECEIPTS", 1000);
const TEACHER_PASSWORD = process.env.LOADTEST_TEACHER_PASSWORD || "Teacher@2026!";

const classOptions = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const sectionOptions = ["A", "B", "C", "D"];
const subjects = ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Telugu", "Computer Science", "Physical Education"];
const firstNames = [
  "Aarav",
  "Aditi",
  "Arjun",
  "Diya",
  "Ishaan",
  "Kavya",
  "Mohan",
  "Nisha",
  "Pranav",
  "Riya",
  "Saanvi",
  "Vikram"
];
const lastNames = ["Rao", "Kumar", "Reddy", "Sharma", "Naidu", "Patel", "Das", "Verma", "Nair", "Iyer"];

function readCount(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

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

function getAdminServices() {
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

  return { auth: getAuth(app), db: getFirestore(app) };
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function studentName(index: number) {
  return `${pick(firstNames, index)} ${pick(lastNames, Math.floor(index / firstNames.length))}`;
}

function adultName(index: number) {
  return `${pick(["Ramesh", "Suresh", "Lakshmi", "Anita", "Rajesh", "Sunita", "Prakash", "Meena"], index)} ${pick(lastNames, index)}`;
}

function phone(seed: number) {
  return `9${String(100000000 + seed).slice(-9)}`;
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function isoDateDaysAgo(days: number) {
  return dateDaysAgo(days).toISOString().slice(0, 10);
}

function teacherEmail(employeeId: string) {
  return `${employeeId.trim().toLowerCase()}@srinarayana.local`;
}

function teacherDocId(employeeId: string) {
  return `teacher_${employeeId.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

async function ensureTeacherUser(auth: ReturnType<typeof getAuth>, teacherId: string, employeeId: string, fullName: string) {
  const email = teacherEmail(employeeId);
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { displayName: fullName, disabled: false });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "auth/user-not-found") throw error;
    user = await auth.createUser({ email, password: TEACHER_PASSWORD, displayName: fullName });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: "teacher",
    teacherId,
    employeeId,
    status: "active"
  });

  return { uid: user.uid, email };
}

function createStudentBase(index: number) {
  const number = index + 1;
  const className = pick(classOptions, index);
  const section = pick(sectionOptions, Math.floor(index / classOptions.length));
  const name = studentName(index);
  const annualEnrollmentFee = 18000 + (classOptions.indexOf(className) + 1) * 1250;
  const commitmentFee = 3500 + (index % 5) * 500;
  const transportFee = index % 3 === 0 ? 6000 + (index % 4) * 500 : 0;
  const totalFeeAmount = annualEnrollmentFee + commitmentFee + transportFee;

  return {
    id: `loadtest_student_${pad(number, 4)}`,
    admissionNumber: `TST-${pad(number, 4)}`,
    studentName: name,
    class: className,
    section,
    gender: index % 2 === 0 ? "Male" : "Female",
    fatherName: adultName(index),
    fatherPhone: phone(200000 + index),
    motherName: adultName(index + 3),
    motherPhone: phone(300000 + index),
    parentName: adultName(index),
    parentMobile: phone(200000 + index),
    dateOfBirth: dateDaysAgo(365 * (5 + (index % 12))),
    email: `student.${pad(number, 4)}@example.test`,
    phone: phone(400000 + index),
    address: `Load Test Street ${number}, Hyderabad`,
    photoURL: "",
    aadhaarNumber: "",
    documentURLs: [],
    previousSchool: null,
    siblingAdmissionNumbers: [],
    emergencyContact: { name: adultName(index + 5), phone: phone(500000 + index), relation: "Guardian" },
    transportRouteId: "",
    transportStopName: transportFee > 0 ? `Stop ${1 + (index % 8)}` : "",
    transportFee,
    annualEnrollmentFee,
    commitmentFee,
    totalFeeAmount,
    totalFeesDue: totalFeeAmount,
    totalFeesPaid: 0,
    feeStatus: "pending",
    attendancePercentage: 75 + (index % 24),
    admissionStatus: "approved",
    feeLastUpdated: dateDaysAgo(index % 10),
    createdAt: dateDaysAgo(60 + (index % 30)),
    updatedAt: dateDaysAgo(index % 10),
    loadTestRunId: RUN_ID,
    isLoadTestData: true
  };
}

async function commitChunks(db: ReturnType<typeof getFirestore>, writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + 450)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
    committed += Math.min(450, writes.length - i);
    console.log(`Committed ${committed}/${writes.length} Firestore documents...`);
  }
}

async function countRunDocs(db: ReturnType<typeof getFirestore>, collectionName: string) {
  const snap = await db.collection(collectionName).where("loadTestRunId", "==", RUN_ID).get();
  return snap.size;
}

async function main() {
  const { auth, db } = getAdminServices();
  const now = new Date();
  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  const students = Array.from({ length: STUDENT_COUNT }, (_, index) => createStudentBase(index));
  const runningDue = new Map(students.map((student) => [student.id, student.totalFeeAmount]));
  const runningPaid = new Map(students.map((student) => [student.id, 0]));

  for (let index = 0; index < DRIVER_COUNT; index += 1) {
    const number = index + 1;
    writes.push({
      ref: db.collection("vehicles").doc(`loadtest_vehicle_${pad(number, 3)}`),
      data: {
        regNo: `TS09LT${pad(number, 4)}`,
        model: pick(["School Bus 40", "Mini Bus 28", "Van 14"], index),
        capacity: pick([40, 32, 28, 14], index),
        driverName: adultName(index + 40),
        driverPhone: phone(600000 + index),
        createdAt: dateDaysAgo(45 + index),
        updatedAt: now,
        loadTestRunId: RUN_ID,
        isLoadTestData: true
      }
    });
  }

  console.log(`Ensuring ${TEACHER_COUNT} teacher auth users and profiles...`);
  for (let index = 0; index < TEACHER_COUNT; index += 1) {
    const number = index + 1;
    const employeeId = `LT-TCH-${pad(number, 3)}`;
    const teacherId = teacherDocId(employeeId);
    const fullName = `${adultName(index + 80)} Teacher`;
    const { uid, email } = await ensureTeacherUser(auth, teacherId, employeeId, fullName);
    const teacherProfile = {
      id: teacherId,
      uid,
      fullName,
      employeeId,
      employeeIdLower: employeeId.toLowerCase(),
      internalEmail: email,
      subject: pick(subjects, index),
      phone: phone(700000 + index),
      baseSalary: 28000 + (index % 8) * 1500,
      biometricUserId: `LTBIO${pad(number, 3)}`,
      joiningDate: isoDateDaysAgo(365 + index * 8),
      status: "active",
      role: "teacher",
      employmentType: "full_time",
      allowedCLPerMonth: 3,
      lateDeductionRule: "after_3_lates_one_day",
      profilePhotoUrl: "",
      createdAt: dateDaysAgo(120 + index),
      updatedAt: now,
      loadTestRunId: RUN_ID,
      isLoadTestData: true
    };

    writes.push({ ref: db.collection("teachers").doc(teacherId), data: teacherProfile });
    writes.push({
      ref: db.collection("users").doc(uid),
      data: {
        uid,
        role: "teacher",
        teacherId,
        employeeId,
        internalEmail: email,
        displayName: fullName,
        status: "active",
        createdAt: teacherProfile.createdAt,
        updatedAt: now,
        loadTestRunId: RUN_ID,
        isLoadTestData: true
      }
    });
  }

  for (let index = 0; index < RECEIPT_COUNT; index += 1) {
    const number = index + 1;
    const student = students[index % students.length];
    const amountDue = runningDue.get(student.id) ?? student.totalFeeAmount;
    const amountPaid = Math.min(amountDue, 3500 + (index % 8) * 750);
    const remainingAmount = Math.max(0, amountDue - amountPaid);
    const paidSoFar = (runningPaid.get(student.id) ?? 0) + amountPaid;
    const paymentDate = dateDaysAgo(index % 45);
    const paymentId = `loadtest_payment_${pad(number, 5)}`;
    const receiptId = `loadtest_receipt_${pad(number, 5)}`;
    const receiptNumber = `LT-RCP-${pad(number, 6)}`;
    const feeStatus = remainingAmount === 0 ? "paid" : amountPaid > 0 ? "partial" : "pending";

    runningDue.set(student.id, remainingAmount);
    runningPaid.set(student.id, paidSoFar);

    writes.push({
      ref: db.collection("payments").doc(paymentId),
      data: {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        amountDue,
        amountPaid,
        remainingAmount,
        paymentType: index % 2 === 0 ? "annual_enrollment" : "commitment",
        concessionApplied: false,
        concessionId: null,
        paymentDate,
        paymentMethod: pick(["cash", "upi", "card", "cheque", "bank_transfer"], index),
        transactionId: `LT-TXN-${pad(number, 6)}`,
        receiptNumber,
        remarks: "Generated capacity test payment",
        recordedBy: "loadtest-seeder",
        status: "completed",
        createdAt: paymentDate,
        updatedAt: paymentDate,
        loadTestRunId: RUN_ID,
        isLoadTestData: true
      }
    });

    writes.push({
      ref: db.collection("receipts").doc(receiptId),
      data: {
        receiptNumber,
        paymentId,
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        amountPaid,
        paymentDate,
        receiptDate: paymentDate,
        issuedBy: "loadtest-seeder",
        status: "issued",
        createdAt: paymentDate,
        loadTestRunId: RUN_ID,
        isLoadTestData: true
      }
    });
  }

  for (const student of students) {
    const totalFeesPaid = runningPaid.get(student.id) ?? 0;
    const totalFeesDue = runningDue.get(student.id) ?? student.totalFeeAmount;
    writes.push({
      ref: db.collection("students").doc(student.id),
      data: {
        ...student,
        totalFeesPaid,
        totalFeesDue,
        feeStatus: totalFeesDue === 0 ? "paid" : totalFeesPaid > 0 ? "partial" : "pending",
        lastPaymentDate: totalFeesPaid > 0 ? now : null,
        feeLastUpdated: now,
        updatedAt: now
      }
    });
  }

  console.log(`Writing ${writes.length} Firestore documents for run "${RUN_ID}"...`);
  await commitChunks(db, writes);

  const [studentTotal, teacherTotal, vehicleTotal, paymentTotal, receiptTotal] = await Promise.all([
    countRunDocs(db, "students"),
    countRunDocs(db, "teachers"),
    countRunDocs(db, "vehicles"),
    countRunDocs(db, "payments"),
    countRunDocs(db, "receipts")
  ]);

  console.log("Capacity seed complete.");
  console.log(`Students: ${studentTotal}`);
  console.log(`Teachers: ${teacherTotal}`);
  console.log(`Drivers/vehicles: ${vehicleTotal}`);
  console.log(`Payments: ${paymentTotal}`);
  console.log(`Receipts: ${receiptTotal}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
