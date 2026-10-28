/**
 * Admin / Principal / Accountant data layer.
 * Every read goes through the web app's /api/admin/* routes so the server's
 * requirePermission() RBAC layer is enforced. No Firestore client reads.
 */
import { auth } from "@/lib/firebase";
import { API_BASE_URL, API_REQUESTS_AVAILABLE } from "@/lib/api";

async function adminGet<T>(path: string): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  if (!API_REQUESTS_AVAILABLE) throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = (await response.json()) as {
    ok?: boolean;
    success?: boolean;
    error?: string;
  } & Record<string, unknown>;
  if (!response.ok || result.ok === false || result.success === false) {
    throw new Error(result.error ?? "Request failed. Please try again.");
  }
  return result as T;
}

async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  if (!API_REQUESTS_AVAILABLE) throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const result = (await response.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? "Request failed. Please try again.");
  }
  return result as T;
}

async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || result.ok === false) throw new Error(result.error ?? "Update failed.");
  return result as T;
}

async function adminDelete<T>(path: string): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || result.ok === false) throw new Error(result.error ?? "Delete failed.");
  return result as T;
}

/* ------------------------------------------------------------------ types */

export type DashboardStats = {
  totalStudents: number;
  totalFeeAmount: number;
  totalFeeDue: number;
  totalFeeCollected: number;
  totalFeeOutstanding: number;
  studentsWithOutstandingFees: number;
  pendingApprovals: number;
  monthlyCollection: number;
};

export type AdminPayment = {
  id: string;
  studentId?: string;
  studentName?: string;
  class?: string;
  section?: string;
  amountPaid?: number;
  amountDue?: number;
  remainingAmount?: number;
  paymentMethod?: string;
  paymentType?: string;
  feeType?: string;
  receiptNumber?: string;
  receiptId?: string;
  status?: string;
  createdAt?: string;
  paymentDate?: string;
  remarks?: string;
};

export type PaymentPage = {
  payments: AdminPayment[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ReceiptFeeItem = {
  name?: string;
  label?: string;
  type?: string;
  description?: string;
  periodOrMonth?: string;
  remarks?: string;
  amount?: number;
};

export type ReceiptRecord = {
  id?: string;
  receiptNo?: string;
  receiptNumber?: string;
  paymentId?: string;
  academicYear?: string;
  studentId?: string;
  studentName?: string;
  admissionNo?: string;
  className?: string;
  section?: string;
  parentName?: string;
  mobile?: string;
  paymentDate?: string;
  paymentMode?: string;
  feeItems?: ReceiptFeeItem[];
  totalPaid?: number;
  balanceDue?: number;
  createdByUsername?: string;
  status?: string;
};

export type StudentRecord = {
  id: string;
  studentName?: string;
  admissionNumber?: string;
  admissionNo?: string;
  class?: string;
  section?: string;
  rollNo?: number;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  fatherPhone?: string;
  motherPhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  dateOfBirth?: unknown;
  status?: string;
  feeStatus?: string;
  totalFeeAmount?: number;
  totalFeesPaid?: number;
  totalFeesDue?: number;
  totalConcessionAmount?: number;
  academicYearId?: string;
  feeHeads?: { name?: string; original?: number; committed?: number; amount?: number }[];
};

export type StudentPage = {
  students: StudentRecord[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type DueStudent = {
  id: string;
  name: string;
  phone: string;
  parentName: string;
  due: number;
};

export type DueClass = {
  className: string;
  studentCount: number;
  totalDue: number;
  students: DueStudent[];
};

export type DuesPage = {
  classes: DueClass[];
  grandTotalDue: number;
  studentsWithDues: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type AdminTeacherDetail = AdminTeacher & {
  baseSalary?: number;
  joiningDate?: string;
  employmentType?: string;
  role?: string;
  biometricUserId?: string;
  internalEmail?: string;
  allowedCLPerMonth?: number;
};

export type TeacherAttendanceDay = {
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
};

export type TeacherAttendanceSummary = {
  month: string;
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  records: TeacherAttendanceDay[];
};

export type Expense = {
  id: string;
  category?: string;
  description?: string;
  vendor?: string;
  amount?: number;
  date?: string;
  status?: string;
  paymentMethod?: string;
  voucherId?: string;
  voucherNo?: number;
  createdAt?: unknown;
};

export type CashBookEntry = {
  date?: string;
  type?: "income" | "expense" | string;
  category?: string;
  description?: string;
  amount?: number;
  balance?: number;
  source?: string;
  refId?: string;
};

export type DebitVoucher = {
  id: string;
  voucherNo?: number;
  amount?: number;
  paidTo?: string;
  date?: string;
  expenseCategory?: string;
  towards?: string;
  description?: string;
};

export type HomeworkPost = {
  title: string;
  description: string;
  subject: string;
  className: string;
  section?: string;
  assignedDate: string;
  dueDate: string;
  academicYearId: string;
};

export type HomeworkItem = {
  id: string;
  title?: string;
  description?: string;
  subject?: string;
  className?: string;
  section?: string;
  assignedDate?: string;
  dueDate?: string;
  status?: string;
  createdAt?: unknown;
};

export type AcademicYear = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ExamTimetableEntry = {
  subject?: string;
  date?: string;
  time?: string;
  maxMarks?: number;
};

export type Exam = {
  id: string;
  name?: string;
  examType?: string;
  className?: string;
  section?: string;
  academicYearId?: string;
  startDate?: string;
  endDate?: string;
  maxMarks?: number;
  status?: string;
  timetable?: ExamTimetableEntry[];
};

export type HallTicket = {
  examName?: string;
  examType?: string;
  startDate?: string;
  endDate?: string;
  studentName?: string;
  className?: string;
  section?: string;
  admissionNo?: string;
  studentPhoto?: string | null;
  timetable?: ExamTimetableEntry[];
  generalInstructions?: string[];
};

export type LeaveRequest = {
  id: string;
  teacherName?: string;
  teacherId?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  reason?: string;
  status?: "pending" | "approved" | "rejected";
  requestedAt?: string;
};

export type Notice = {
  id: string;
  title?: string;
  body?: string;
  audience?: string;
  category?: string;
  audienceRoles?: string[];
  audienceClasses?: string[];
  createdAt?: string;
};

export type AdminTeacher = {
  id: string;
  fullName?: string;
  subject?: string;
  employeeId?: string;
  status?: string;
  phone?: string;
};

export type FinanceSummary = {
  income: { fees: number; other: number; total: number };
  expense: { general: number; salary: number; advances: number; total: number };
  net: number;
};

/* ------------------------------------------------------------------ reads */

export async function fetchDashboardStats() {
  const result = await adminGet<{ data: DashboardStats }>("/api/admin/reports/dashboard-stats");
  return result.data;
}

export async function fetchRecentPayments(pageSize = 10, cursor = "", studentId = ""): Promise<PaymentPage> {
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursor) query.set("cursor", cursor);
  if (studentId) query.set("studentId", studentId);
  const result = await adminGet<{
    data?: AdminPayment[];
    nextCursor?: string | null;
    hasMore?: boolean;
  }>(`/api/admin/payments?${query.toString()}`);
  return {
    payments: result.data ?? [],
    nextCursor: result.nextCursor ?? null,
    hasMore: result.hasMore === true
  };
}

/** Full receipt plus everything needed to show a student's payment history. */
export async function fetchReceipt(receiptId: string) {
  const result = await adminGet<{ receipt: ReceiptRecord; canPrint?: boolean }>(
    `/api/admin/receipts/${encodeURIComponent(receiptId)}`
  );
  return { receipt: result.receipt, canPrint: result.canPrint === true };
}

/** Create (or reuse) the receipt's public read-only share link. */
export async function fetchReceiptShareLink(receiptId: string) {
  const result = await adminPost<{ url: string; expiresAt?: string }>(
    `/api/admin/receipts/${encodeURIComponent(receiptId)}/share-link`,
    {}
  );
  return { url: result.url, expiresAt: result.expiresAt };
}

export async function fetchStudentPayments(studentId: string, pageSize = 20) {
  const page = await fetchRecentPayments(pageSize, "", studentId);
  return page.payments;
}

export async function fetchStudents(params: { q?: string; cursor?: string; pageSize?: number } = {}): Promise<StudentPage> {
  const query = new URLSearchParams({ pageSize: String(params.pageSize ?? 25) });
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.cursor) query.set("cursor", params.cursor);
  const result = await adminGet<{
    data?: StudentRecord[];
    nextCursor?: string | null;
    hasMore?: boolean;
  }>(`/api/admin/students?${query.toString()}`);
  return {
    students: result.data ?? [],
    nextCursor: result.nextCursor ?? null,
    hasMore: result.hasMore === true
  };
}

export async function fetchStudent(studentId: string) {
  const result = await adminGet<{ data: StudentRecord }>(
    `/api/admin/students/${encodeURIComponent(studentId)}`
  );
  return result.data;
}

export async function fetchDues(limit = 25, cursor = ""): Promise<DuesPage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const result = await adminGet<{
    classes?: DueClass[];
    grandTotalDue?: number;
    studentsWithDues?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  }>(`/api/admin/finance/dues?${query.toString()}`);
  return {
    classes: result.classes ?? [],
    grandTotalDue: Number(result.grandTotalDue ?? 0),
    studentsWithDues: Number(result.studentsWithDues ?? 0),
    nextCursor: result.nextCursor ?? null,
    hasMore: result.hasMore === true
  };
}

export async function fetchTeacher(teacherId: string) {
  const result = await adminGet<{ teacher: AdminTeacherDetail }>(
    `/api/admin/teachers/${encodeURIComponent(teacherId)}`
  );
  return result.teacher;
}

export async function fetchTeacherAttendanceSummary(teacherId: string, month = "") {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const result = await adminGet<TeacherAttendanceSummary>(
    `/api/admin/teachers/${encodeURIComponent(teacherId)}/attendance-summary${query}`
  );
  return {
    month: result.month,
    workingDays: Number(result.workingDays ?? 0),
    present: Number(result.present ?? 0),
    late: Number(result.late ?? 0),
    absent: Number(result.absent ?? 0),
    records: result.records ?? []
  };
}

export type ExamInput = {
  name: string;
  academicYearId: string;
  className: string;
  section?: string;
  examType: "unit_test" | "midterm" | "final" | "olympiad" | "other";
  startDate: string;
  endDate?: string;
  maxMarks: number;
  status?: "scheduled" | "ongoing" | "completed" | "published";
};

export async function createExam(input: ExamInput) {
  const result = await adminPost<{ id: string }>("/api/admin/exams", input);
  return result.id;
}

export async function updateExam(examId: string, input: Partial<ExamInput>) {
  return adminPatch<{ ok: boolean }>(`/api/admin/exams/${encodeURIComponent(examId)}`, input);
}

export async function deleteExam(examId: string) {
  return adminDelete<{ ok: boolean }>(`/api/admin/exams/${encodeURIComponent(examId)}`);
}

export type NoticeInput = {
  title: string;
  body: string;
  category?: "school" | "branch" | "class" | "holiday" | "exam" | "event" | "fee" | "emergency";
  audienceRoles?: string[];
  channels?: ("app" | "whatsapp" | "email")[];
  academicYearId?: string;
};

export async function createNotice(input: NoticeInput) {
  const result = await adminPost<{ id: string }>("/api/admin/notices", input);
  return result.id;
}

export async function updateNotice(noticeId: string, input: Partial<NoticeInput>) {
  return adminPatch<{ ok: boolean }>(`/api/admin/notices/${encodeURIComponent(noticeId)}`, input);
}

export async function deleteNotice(noticeId: string) {
  return adminDelete<{ ok: boolean }>(`/api/admin/notices/${encodeURIComponent(noticeId)}`);
}

export async function fetchLeaveRequests() {
  const result = await adminGet<{ requests: LeaveRequest[] }>("/api/admin/leave-requests");
  return result.requests ?? [];
}

export async function reviewLeaveRequest(
  requestId: string,
  status: "approved" | "rejected",
  adminNote = ""
) {
  return adminPatch("/api/admin/leave-requests", { requestId, status, adminNote });
}

export async function fetchNotices() {
  const result = await adminGet<{ notices: Notice[] }>("/api/admin/notices");
  return result.notices ?? [];
}

export async function fetchTeachers(limitTo = 50) {
  const result = await adminGet<{ teachers: AdminTeacher[] }>(
    `/api/admin/teachers?limit=${limitTo}`
  );
  return result.teachers ?? [];
}

export type StaffDriver = {
  id: string;
  name?: string;
  phone?: string;
  mobile?: string;
  vehicleNo?: string;
  vehicle?: string;
  licenseNo?: string;
  status?: string;
};

export type StaffOffice = {
  id: string;
  displayName?: string;
  role?: string;
  email?: string;
  phone?: string;
  status?: string;
  uid?: string;
  teacherId?: string;
  employeeId?: string;
};

export type StaffDirectory = {
  teachers: AdminTeacher[];
  drivers: StaffDriver[];
  office: StaffOffice[];
  other: StaffOffice[];
};

export async function fetchStaffDirectory() {
  const result = await adminGet<StaffDirectory>("/api/admin/staff/directory");
  return {
    teachers: result.teachers ?? [],
    drivers: result.drivers ?? [],
    office: result.office ?? [],
    other: result.other ?? []
  };
}

export async function fetchFinanceSummary() {
  const result = await adminGet<{ summary: FinanceSummary }>("/api/admin/finance/summary");
  return result.summary;
}

export async function fetchExpenses(pageSize = 30, cursor = "") {
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursor) query.set("cursor", cursor);
  const result = await adminGet<{ expenses: Expense[]; nextCursor: string | null; hasMore: boolean }>(
    `/api/admin/finance/expenses?${query.toString()}`
  );
  return {
    expenses: result.expenses ?? [],
    nextCursor: result.nextCursor ?? null,
    hasMore: result.hasMore === true
  };
}

export async function fetchCashBook() {
  const result = await adminGet<{ entries: CashBookEntry[]; closingBalance: number }>(
    "/api/admin/finance/cash-book"
  );
  return { entries: result.entries ?? [], closingBalance: Number(result.closingBalance ?? 0) };
}

export async function fetchVouchersByIds(ids: string[]) {
  const clean = ids.filter(Boolean).slice(0, 10);
  if (clean.length === 0) return [];
  const result = await adminGet<{ vouchers: DebitVoucher[] }>(
    `/api/admin/finance/debit-vouchers?ids=${clean.map(encodeURIComponent).join(",")}`
  );
  return result.vouchers ?? [];
}

export async function fetchVouchersByCategory(category: string, limit = 3) {
  if (!category) return [];
  const query = new URLSearchParams({ category, limit: String(limit) });
  const result = await adminGet<{ vouchers: DebitVoucher[] }>(
    `/api/admin/finance/debit-vouchers?${query.toString()}`
  );
  return result.vouchers ?? [];
}

/** Academic years are public (year labels only) — no auth token needed. */
export async function fetchAcademicYears() {
  if (!API_REQUESTS_AVAILABLE) throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  const response = await fetch(`${API_BASE_URL}/api/academic-years/public`);
  const result = (await response.json()) as { ok?: boolean; years?: AcademicYear[]; error?: string };
  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? "Unable to load academic years.");
  }
  return result.years ?? [];
}

export async function fetchPostedHomework(params: { subject?: string; academicYearId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "20" });
  if (params.subject) query.set("subject", params.subject);
  if (params.academicYearId) query.set("academicYearId", params.academicYearId);
  const result = await adminGet<{ homework: HomeworkItem[] }>(`/api/admin/homework?${query.toString()}`);
  return result.homework ?? [];
}

/** Posts homework; the server validates and pushes parents of the class. */
export async function postHomework(input: HomeworkPost) {
  const result = await adminPost<{ id: string }>("/api/admin/homework", input);
  return result.id;
}

export async function fetchExams(className = "") {
  const query = new URLSearchParams({ pageSize: "30" });
  if (className) query.set("className", className);
  const result = await adminGet<{ exams: Exam[] }>(`/api/admin/exams?${query.toString()}`);
  return result.exams ?? [];
}

export type ChangeRequest = {
  id: string;
  entity: string;
  entityId: string;
  action: "edit" | "delete";
  patch?: Record<string, unknown>;
  note?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy?: string;
  requestedByName?: string;
  decidedBy?: string;
  createdAt?: unknown;
};

export async function fetchChangeRequests(status = "pending") {
  const result = await adminGet<{ requests: ChangeRequest[] }>(
    `/api/admin/change-requests?status=${encodeURIComponent(status)}`
  );
  return result.requests ?? [];
}

export async function decideChangeRequest(id: string, decision: "approved" | "rejected") {
  return adminPost<{ request: ChangeRequest }>(
    `/api/admin/change-requests/${encodeURIComponent(id)}/decide`,
    { decision }
  );
}

export type StaffTask = {
  id: string;
  teacherId?: string;
  teacherName?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  status?: "assigned" | "done" | "cancelled" | string;
  createdAt?: unknown;
};

export async function fetchTasks(teacherId = "") {
  const query = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : "";
  const result = await adminGet<{ tasks: StaffTask[] }>(`/api/admin/tasks${query}`);
  return result.tasks ?? [];
}

export async function assignTask(input: { teacherId: string; title: string; description?: string; dueDate?: string }) {
  const result = await adminPost<{ id: string }>("/api/admin/tasks", input);
  return result.id;
}

export async function updateTaskStatus(taskId: string, status: "done" | "cancelled" | "assigned") {
  return adminPatch<{ ok: boolean }>("/api/admin/tasks", { taskId, status });
}

export type TodayAttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  total: number;
};

/** Today's staff attendance counts (server-side count aggregations). */
export async function fetchTodayAttendance(): Promise<TodayAttendanceSummary> {
  const result = await adminGet<{ present?: number; late?: number; absent?: number; total?: number }>(
    "/api/admin/attendance/summary"
  );
  return {
    present: Number(result.present ?? 0),
    late: Number(result.late ?? 0),
    absent: Number(result.absent ?? 0),
    total: Number(result.total ?? 0)
  };
}
