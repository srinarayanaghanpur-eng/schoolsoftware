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
  studentName?: string;
  class?: string;
  section?: string;
  amountPaid?: number;
  paymentMethod?: string;
  receiptNumber?: string;
  status?: string;
  createdAt?: string;
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

export async function fetchRecentPayments(pageSize = 10) {
  const result = await adminGet<{ data: AdminPayment[] }>(
    `/api/admin/payments?pageSize=${pageSize}`
  );
  return result.data ?? [];
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
};

export type StaffOffice = {
  id: string;
  displayName?: string;
  role?: string;
  email?: string;
  phone?: string;
};

export type StaffDirectory = {
  teachers: AdminTeacher[];
  drivers: StaffDriver[];
  office: StaffOffice[];
};

export async function fetchStaffDirectory() {
  const result = await adminGet<StaffDirectory>("/api/admin/staff/directory");
  return {
    teachers: result.teachers ?? [],
    drivers: result.drivers ?? [],
    office: result.office ?? []
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

/** Today's staff attendance snapshot. */
export async function fetchTodayAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const result = await adminGet<{
    records: { status?: string; teacherId?: string }[];
    teachers: AdminTeacher[];
  }>(`/api/admin/attendance?dateFrom=${today}&dateTo=${today}`);
  return { records: result.records ?? [], teachers: result.teachers ?? [] };
}
