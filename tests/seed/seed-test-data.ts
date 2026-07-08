import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

// ── Emulator connection ──────────────────────────────────────────────────────
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// ── Types ────────────────────────────────────────────────────────────────────
type UserRole = "super_admin" | "admin" | "principal" | "accountant" | "teacher" | "parent" | "settings_manager";
type FeeStatus = "paid" | "partial" | "pending" | "none";
type AttendanceStatus = "present" | "late" | "absent";
type PaymentMode = "cash" | "online" | "cheque";

interface SeedUser {
  employeeId: string;
  role: UserRole;
  name: string;
  password: string;
}

interface SeedStudent {
  name: string;
  studentClass: string;
  section: string;
  totalFees: number;
  paidFees: number;
  dueFees: number;
  feeStatus: FeeStatus;
  parentId: string;
  parentName: string;
  parentPhone: string;
}

interface SeedFeeStructure {
  name: string;
  amount: number;
  frequency: string;
  classes: string[];
  description: string;
}

interface SeedPayment {
  studentId: string;
  studentName: string;
  amount: number;
  mode: PaymentMode;
  createdBy: string;
}

interface SeedAttendance {
  teacherId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const PROJECT_ID = "demo-sri-narayana-erp";
const PASSWORD = "Test@123";

const USERS: SeedUser[] = [
  { employeeId: "SUPER001", role: "super_admin", name: "Test Super Admin", password: PASSWORD },
  { employeeId: "ADMIN001", role: "admin", name: "Test Admin", password: PASSWORD },
  { employeeId: "PRIN001", role: "principal", name: "Test Principal", password: PASSWORD },
  { employeeId: "ACCT001", role: "accountant", name: "Test Accountant", password: PASSWORD },
  { employeeId: "TEACH001", role: "teacher", name: "Test Teacher", password: PASSWORD },
  { employeeId: "PARENT001", role: "parent", name: "Test Parent", password: PASSWORD },
  { employeeId: "SETTINGS001", role: "settings_manager", name: "Test Settings Manager", password: PASSWORD },
];

const CLASSES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const SECTIONS = ["A", "B", "C"];

const STUDENTS: SeedStudent[] = [
  // 5 fully paid students
  ...(["Rahul Sharma", "Priya Patel", "Amit Singh", "Sneha Reddy", "Vikram Joshi"] as const).map((name, i) => ({
    name, studentClass: CLASSES[i % CLASSES.length], section: SECTIONS[i % SECTIONS.length],
    totalFees: 30000, paidFees: 30000, dueFees: 0, feeStatus: "paid" as FeeStatus,
    parentId: "", parentName: "Test Parent", parentPhone: "9876543210",
  })),
  // 5 partial students
  ...(["Ananya Gupta", "Rohit Verma", "Kavita Nair", "Arjun Menon", "Divya Desai"] as const).map((name, i) => ({
    name, studentClass: CLASSES[(i + 5) % CLASSES.length], section: SECTIONS[(i + 1) % SECTIONS.length],
    totalFees: 30000, paidFees: [10000, 15000, 12000, 18000, 8000][i], dueFees: [20000, 15000, 18000, 12000, 22000][i],
    feeStatus: "partial" as FeeStatus,
    parentId: "", parentName: "Test Parent", parentPhone: "9876543210",
  })),
  // 5 pending students
  ...(["Manish Kumar", "Pooja Mehta", "Sunil Rao", "Neha Kapoor", "Rajesh Tiwari"] as const).map((name, i) => ({
    name, studentClass: CLASSES[(i + 2) % CLASSES.length], section: SECTIONS[(i + 2) % SECTIONS.length],
    totalFees: 30000, paidFees: 0, dueFees: 30000, feeStatus: "pending" as FeeStatus,
    parentId: "", parentName: "Test Parent", parentPhone: "9876543210",
  })),
];

const FEE_STRUCTURES: SeedFeeStructure[] = [
  { name: "Annual Tuition Fee", amount: 30000, frequency: "annual", classes: CLASSES, description: "Annual tuition fee for all classes" },
  { name: "Lab Fee", amount: 5000, frequency: "annual", classes: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"], description: "Science lab fee for secondary classes" },
  { name: "Transport Fee", amount: 12000, frequency: "annual", classes: CLASSES, description: "Annual transport fee for bus facility" },
];

function toInternalEmail(employeeId: string): string {
  return `${employeeId.toLowerCase()}@teacher-nara.firebaseapp.com`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ── App initialisation ───────────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
  return initializeApp({ projectId: PROJECT_ID });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function deleteCollection(db: Firestore, collectionPath: string, batchSize = 50) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(batchSize).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  process.stdout.write(`  🗑  Cleared ${snapshot.size} docs from "${collectionPath}"\n`);
}

async function createAuthUser(auth: ReturnType<typeof getAuth>, user: SeedUser): Promise<UserRecord> {
  const email = toInternalEmail(user.employeeId);
  try {
    const existing = await auth.getUserByEmail(email);
    process.stdout.write(`  ⚡ Auth user ${user.employeeId} already exists (uid: ${existing.uid.slice(0, 12)}…)\n`);
    return existing;
  } catch {
    // not found – create
  }
  const record = await auth.createUser({
    email,
    password: user.password,
    displayName: user.name,
    disabled: false,
  });
  await auth.setCustomUserClaims(record.uid, { role: user.role });
  process.stdout.write(`  ✅ Created auth user ${user.employeeId} (uid: ${record.uid.slice(0, 12)}…)\n`);
  return record;
}

async function upsertUserDoc(
  db: Firestore,
  uid: string,
  user: SeedUser,
) {
  const now = new Date().toISOString();
  await db.collection("users").doc(uid).set({
    uid,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
    email: toInternalEmail(user.employeeId),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function upsertStudentDoc(
  db: Firestore,
  student: SeedStudent,
  index: number,
  id: string,
) {
  const now = new Date().toISOString();
  const admissionDate = new Date(2026, 3, 1 + index);
  await db.collection("students").doc(id).set({
    id,
    admissionNumber: `SNHS${String(2026000 + index + 1)}`,
    name: student.name,
    studentName: student.name,
    class: student.studentClass,
    className: student.studentClass,
    section: student.section,
    totalFees: student.totalFees,
    totalFeeAmount: student.totalFees,
    totalFeesDue: student.dueFees,
    totalFeesPaid: student.paidFees,
    paidFees: student.paidFees,
    dueFees: student.dueFees,
    feeStatus: student.feeStatus,
    parentId: student.parentId,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    admissionDate: admissionDate.toISOString(),
    address: `${student.name.split(" ").pop()?.toLowerCase() ?? "test"}-address, Ghanpur, Jayashankar Bhupalpally`,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

// ── Main seeder ──────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n🚀 Sri Narayana ERP – Test Data Seeder\n");
  console.log("─".repeat(50));

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ── 1. Clear existing data ─────────────────────────────────────────────────
  console.log("\n📦 Clearing existing data …\n");
  const collections = [
    "academic_years", "classes", "sections", "school_info",
    "users", "students", "fee_structures", "payments",
    "attendance", "fee_reminders", "holidays",
    "concessions", "roles", "receipt_counters", "receipts",
    "parent_student_links",
  ];
  for (const col of collections) {
    await deleteCollection(db, col);
  }
  console.log();

  // ── 2. Academic setup ──────────────────────────────────────────────────────
  console.log("📚 Academic setup …\n");

  const academicYearRef = db.collection("academic_years").doc("ay-2026-27");
  await academicYearRef.set({
    id: "ay-2026-27",
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isActive: true,
    current: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  process.stdout.write("  ✅ Academic year 2026-27 (active)\n");

  for (const cls of CLASSES) {
    await db.collection("classes").doc(cls).set({
      name: cls,
      displayName: cls,
      sections: SECTIONS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  process.stdout.write(`  ✅ ${CLASSES.length} classes created\n`);

  for (const section of SECTIONS) {
    await db.collection("sections").doc(section).set({
      name: section,
      displayName: `Section ${section}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  process.stdout.write(`  ✅ ${SECTIONS.length} sections created\n`);

  await db.collection("school_info").doc("default").set({
    schoolName: "Sri Narayana High School",
    address: "Ghanpur, Jayashankar Bhupalpally-506135",
    phone: "6300038389",
    email: "info@srinarayana.edu",
    academicYearId: "ay-2026-27",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  process.stdout.write("  ✅ School info document created\n");

  // ── 3. Users (Auth + Firestore) ────────────────────────────────────────────
  console.log("\n👤 Creating users …\n");

  const userUids: Record<string, string> = {};
  for (const user of USERS) {
    const record = await createAuthUser(auth, user);
    await upsertUserDoc(db, record.uid, user);
    userUids[user.employeeId] = record.uid;
  }

  // Link the parent uid into students
  const parentUid = userUids["PARENT001"];

  // ── 4. Students ────────────────────────────────────────────────────────────
  console.log("\n🎓 Creating students …\n");

  const studentIds: string[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = { ...STUDENTS[i], parentId: parentUid };
    const id = `student_${String(i + 1).padStart(3, "0")}`;
    await upsertStudentDoc(db, s, i, id);
    studentIds.push(id);
    process.stdout.write(`  ✅ ${s.name.padEnd(20)} | ${s.studentClass.padEnd(8)} ${s.section} | ${s.feeStatus.padEnd(7)} | ₹${s.dueFees}\n`);
  }

  // ── 5. Fee structures ──────────────────────────────────────────────────────
  console.log("\n💰 Creating fee structures …\n");

  for (const fs of FEE_STRUCTURES) {
    const id = fs.name.toLowerCase().replace(/\s+/g, "_");
    await db.collection("fee_structures").doc(id).set({
      id,
      name: fs.name,
      amount: fs.amount,
      frequency: fs.frequency,
      class: fs.classes,
      classes: fs.classes,
      description: fs.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    process.stdout.write(`  ✅ ${fs.name.padEnd(25)} ₹${fs.amount}\n`);
  }

  // ── 6. Payments ────────────────────────────────────────────────────────────
  console.log("\n💳 Creating payments …\n");

  const superUid = userUids["SUPER001"];

  // Partial student payments (indexes 5-9 in STUDENTS array)
  const partialPayments: SeedPayment[] = [
    { studentId: studentIds[5], studentName: STUDENTS[5].name, amount: 5000, mode: "cash", createdBy: "SUPER001" },
    { studentId: studentIds[5], studentName: STUDENTS[5].name, amount: 5000, mode: "online", createdBy: "SUPER001" },
    { studentId: studentIds[6], studentName: STUDENTS[6].name, amount: 10000, mode: "cheque", createdBy: "SUPER001" },
    { studentId: studentIds[6], studentName: STUDENTS[6].name, amount: 5000, mode: "online", createdBy: "SUPER001" },
    { studentId: studentIds[7], studentName: STUDENTS[7].name, amount: 12000, mode: "cash", createdBy: "SUPER001" },
  ];

  // Paid student payments (indexes 0-4, full 30000 each)
  const paidPayments: SeedPayment[] = [0, 1, 2, 3, 4].map((i) => ({
    studentId: studentIds[i],
    studentName: STUDENTS[i].name,
    amount: 30000,
    mode: "online" as PaymentMode,
    createdBy: "SUPER001",
  }));

  const allPayments = [...partialPayments, ...paidPayments];
  for (let i = 0; i < allPayments.length; i++) {
    const p = allPayments[i];
    const paymentDate = new Date(2026, 3, 10 + i, 10, 30, 0);
    const id = `payment_${String(i + 1).padStart(3, "0")}`;
    const receiptNo = `SNHS/2026-27/${String(i + 1).padStart(4, "0")}`;
    await db.collection("payments").doc(id).set({
      id,
      studentId: p.studentId,
      studentName: p.studentName,
      amount: p.amount,
      amountPaid: p.amount,
      paymentDate: paymentDate.toISOString(),
      mode: p.mode,
      paymentMethod: p.mode,
      receiptNumber: receiptNo,
      createdBy: superUid,
      createdByUserId: superUid,
      status: "completed",
      createdAt: paymentDate.toISOString(),
      updatedAt: paymentDate.toISOString(),
    });
    process.stdout.write(`  ✅ ${p.studentName.padEnd(20)} ₹${String(p.amount).padStart(5)} ${p.mode.padEnd(7)} receipt: ${receiptNo}\n`);
  }

  // ── 7. Attendance records ──────────────────────────────────────────────────
  console.log("\n📋 Creating attendance records …\n");

  const teacherUid = userUids["TEACH001"];
  // Past 5 working days
  const today = new Date();
  let workingDayCount = 0;
  const dayStatuses: AttendanceStatus[] = ["present", "present", "present", "late", "absent"];
  const dayIdx = today.getDay(); // 0=Sun
  for (let offset = 1; offset <= 10 && workingDayCount < 5; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    const status = dayStatuses[workingDayCount];
    const dateStr = formatDate(d);
    const checkInTime = status === "absent"
      ? null
      : new Date(d.getFullYear(), d.getMonth(), d.getDate(), status === "late" ? 9 : 8, status === "late" ? 15 : 30, 0).toISOString();
    const checkOutTime = status === "absent"
      ? null
      : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 16, 45, 0).toISOString();

    const id = `att_teach001_${dateStr}`;
    await db.collection("attendance").doc(id).set({
      id,
      teacherId: "TEACH001",
      teacherUid: teacherUid,
      date: dateStr,
      month: dateStr.slice(0, 7),
      year: d.getFullYear(),
      status,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      checkInTime,
      checkOutTime,
      isLate: status === "late",
      lateMinutes: status === "late" ? 45 : 0,
      source: "admin",
      sourcesUsed: ["admin"],
      adminEdited: false,
      createdAt: checkInTime ?? new Date().toISOString(),
      updatedAt: checkOutTime ?? new Date().toISOString(),
    });
    process.stdout.write(`  ✅ ${dateStr.padEnd(12)} ${status.padEnd(7)} TEACH001\n`);
    workingDayCount++;
  }

  // ── 8. Fee reminders ───────────────────────────────────────────────────────
  console.log("\n🔔 Creating fee reminders …\n");

  for (let i = 0; i < 2; i++) {
    const studentIdx = 10 + i; // pending students
    const dueDate = new Date(2026, 8, 15);
    const id = `reminder_${String(i + 1).padStart(3, "0")}`;
    await db.collection("fee_reminders").doc(id).set({
      id,
      studentId: studentIds[studentIdx],
      studentName: STUDENTS[studentIdx].name,
      className: STUDENTS[studentIdx].studentClass,
      amount: STUDENTS[studentIdx].dueFees,
      dueDate: dueDate.toISOString(),
      note: "Fee payment overdue. Please clear at earliest.",
      sent: false,
      createdBy: superUid,
      createdAt: new Date().toISOString(),
    });
    process.stdout.write(`  ✅ Reminder for ${STUDENTS[studentIdx].name.padEnd(20)} ₹${STUDENTS[studentIdx].dueFees}\n`);
  }

  // ── 9. Holiday ─────────────────────────────────────────────────────────────
  console.log("\n🎉 Creating holiday …\n");

  const holidayDate = new Date(today);
  holidayDate.setDate(holidayDate.getDate() + 14);
  const holidayDateStr = formatDate(holidayDate);
  await db.collection("holidays").doc("holiday_upcoming").set({
    id: "holiday_upcoming",
    date: holidayDateStr,
    title: "Sri Narayana Birthday",
    type: "school",
    reason: "Founder's day celebration",
    createdAt: new Date().toISOString(),
  });
  process.stdout.write(`  ✅ ${holidayDateStr} — Sri Narayana Birthday\n`);

  // ── 10. Fee concession ─────────────────────────────────────────────────────
  console.log("\n🎯 Creating fee concession …\n");

  const concessionStudentIdx = 6; // a partial student
  await db.collection("concessions").doc("concession_001").set({
    id: "concession_001",
    studentId: studentIds[concessionStudentIdx],
    admissionNumber: `SNHS${2026000 + concessionStudentIdx + 1}`,
    studentName: STUDENTS[concessionStudentIdx].name,
    class: STUDENTS[concessionStudentIdx].studentClass,
    section: STUDENTS[concessionStudentIdx].section,
    parentName: "Test Parent",
    parentPhone: "9876543210",
    concessionType: "percentage",
    concessionAmount: Math.round(STUDENTS[concessionStudentIdx].totalFees * 0.1),
    concessionPercent: 10,
    reason: "Sibling concession",
    status: "approved",
    approvedBy: superUid,
    approvalDate: new Date().toISOString(),
    approvalNotes: "Approved per sibling policy",
    validFrom: "2026-04-01T00:00:00.000Z",
    validUpto: "2027-03-31T00:00:00.000Z",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  process.stdout.write(`  ✅ 10% concession for ${STUDENTS[concessionStudentIdx].name} (₹${Math.round(STUDENTS[concessionStudentIdx].totalFees * 0.1)})\n`);

  // ── 11. Roles / permissions ────────────────────────────────────────────────
  console.log("\n🛡️  Creating role documents …\n");

  const rolesData: Record<UserRole, { label: string; permissions: string[]; description: string }> = {
    super_admin: { label: "Super Admin", permissions: ["*"], description: "Full system access" },
    admin: {
      label: "Admin",
      permissions: ["dashboard.view", "students.view", "students.create", "students.edit", "students.delete",
        "parents.view", "parents.create", "parents.edit", "staff.view", "staff.create", "staff.edit",
        "attendance.view", "attendance.create", "attendance.edit", "academics.view", "academics.create", "academics.edit",
        "exams.view", "exams.create", "exams.edit", "exams.export",
        "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
        "fee_reminders.view", "fee_reminders.manage_settings",
        "salary.view", "salary.create", "salary.edit", "payroll.view", "payroll.create", "payroll.edit", "payroll.approve",
        "transport.view", "transport.create", "transport.edit",
        "communication.view", "communication.create", "communication.edit",
        "reports.view", "reports.export",
        "settings.view", "settings.create", "settings.edit",
        "users.view", "users.create", "users.edit",
        "roles.view", "roles.edit",
        "permissions.view", "permissions.edit",
        "academic_years.view", "academic_years.create", "academic_years.edit",
        "promotions.view", "promotions.create", "promotions.approve",
        "ai_agent.view", "ai_agent.chat", "ai_agent.settings", "ai_agent.logs",
        "ai_agent.generate_notice", "ai_agent.generate_fee_message", "ai_agent.summarize_reports", "ai_agent.quota"],
      description: "Day-to-day school operations management",
    },
    principal: {
      label: "Principal",
      permissions: ["dashboard.view", "students.view", "students.export", "parents.view", "staff.view",
        "attendance.view", "attendance.export", "attendance.approve",
        "academics.view", "exams.view", "exams.approve", "exams.export",
        "fees.view", "fees.export",
        "salary.view", "payroll.view", "payroll.approve",
        "transport.view", "communication.view", "communication.create",
        "reports.view", "reports.export",
        "academic_years.view",
        "promotions.view", "promotions.create", "promotions.approve",
        "settings.view",
        "ai_agent.view", "ai_agent.chat", "ai_agent.generate_notice", "ai_agent.summarize_reports", "ai_agent.quota"],
      description: "Academic and administrative oversight",
    },
    accountant: {
      label: "Accountant",
      permissions: ["dashboard.view", "students.view", "parents.view",
        "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
        "fee_reminders.view", "fee_reminders.manage_settings",
        "inventory.view", "inventory.create", "inventory.edit",
        "bus_finance.view", "bus_finance.create", "bus_finance.edit", "bus_finance.export",
        "reports.view", "reports.export",
        "academic_years.view",
        "ai_agent.view", "ai_agent.chat", "ai_agent.generate_fee_message", "ai_agent.summarize_reports", "ai_agent.quota"],
      description: "Finance and fee management",
    },
    teacher: {
      label: "Teacher",
      permissions: ["dashboard.view", "students.view",
        "attendance.view", "attendance.create", "attendance.edit",
        "academics.view", "academics.create", "academics.edit",
        "exams.view", "exams.create", "exams.edit",
        "communication.view", "academic_years.view"],
      description: "Teaching staff with attendance and academics access",
    },
    parent: {
      label: "Parent",
      permissions: ["portal.view"],
      description: "Parent portal access",
    },
    settings_manager: {
      label: "Settings Manager",
      permissions: ["dashboard.view",
        "settings.view", "settings.create", "settings.edit", "settings.delete",
        "users.view", "users.create", "users.edit", "users.delete",
        "roles.view", "roles.edit", "roles.manage",
        "permissions.view", "permissions.edit", "permissions.manage",
        "academic_years.view", "academic_years.create", "academic_years.edit", "academic_years.delete",
        "ai_agent.view", "ai_agent.settings", "ai_agent.logs", "ai_agent.quota"],
      description: "System configuration and user management",
    },
  };

  for (const [roleId, data] of Object.entries(rolesData)) {
    await db.collection("roles").doc(roleId).set({
      id: roleId,
      name: roleId,
      label: data.label,
      description: data.description,
      permissions: data.permissions,
      isDefault: roleId === "teacher" || roleId === "parent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    process.stdout.write(`  ✅ ${data.label.padEnd(20)} (${data.permissions.length} permissions)\n`);
  }

  // ── 12. Receipt counters ───────────────────────────────────────────────────
  console.log("\n🔢 Initialising receipt counters …\n");

  await db.collection("receipt_counters").doc("SNHS_2026-27").set({
    academicYear: "2026-27",
    nextNumber: 1001,
    updatedAt: new Date(),
  });
  process.stdout.write("  ✅ Receipt counter SNHS_2026-27 starting at 1001\n");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log("\n✅  SEED COMPLETE\n");
  console.log(`  Users created      : ${USERS.length}`);
  console.log(`  Students created   : ${STUDENTS.length}`);
  console.log(`  Payments created   : ${allPayments.length}`);
  console.log(`  Fee structures     : ${FEE_STRUCTURES.length}`);
  console.log(`  Attendance records : 5`);
  console.log(`  Fee reminders      : 2`);
  console.log(`  Holidays           : 1`);
  console.log(`  Concessions        : 1`);
  console.log(`  Role documents     : ${Object.keys(rolesData).length}`);
  console.log(`\n  Default password   : ${PASSWORD}`);
  console.log(`  Emulator Firestore : localhost:8080`);
  console.log(`  Emulator Auth      : localhost:9099`);
  console.log();

  // Login ID cheat-sheet
  console.log("  ── Login Credentials ──");
  for (const u of USERS) {
    console.log(`    ${u.employeeId.padEnd(14)} | ${u.role.padEnd(16)} | ${PASSWORD}`);
  }
  console.log();
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
