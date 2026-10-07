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
  voucherNo?: number;
  createdAt?: unknown;
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

export async function fetchFinanceSummary() {
  const result = await adminGet<{ summary: FinanceSummary }>("/api/admin/finance/summary");
  return result.summary;
}

export async function fetchExpenses() {
  const result = await adminGet<{ expenses: Expense[] }>("/api/admin/finance/expenses");
  return result.expenses ?? [];
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

/** Today's staff attendance snapshot. */
export async function fetchTodayAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const result = await adminGet<{
    records: { status?: string; teacherId?: string }[];
    teachers: AdminTeacher[];
  }>(`/api/admin/attendance?dateFrom=${today}&dateTo=${today}`);
  return { records: result.records ?? [], teachers: result.teachers ?? [] };
}
