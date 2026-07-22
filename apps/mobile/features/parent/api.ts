/**
 * Parent portal data layer — all reads/writes go through the web app's
 * /api/portal/* endpoints (server-side RBAC + aggregation). No Firestore
 * client reads in the parent workspace.
 */
import { auth } from "@/lib/firebase";
import { API_BASE_URL, API_REQUESTS_AVAILABLE } from "@/lib/api";

export type PortalStudent = { id: string; name: string; className: string; section: string; admissionNo: string };
export type PortalFees = { total: number; paid: number; due: number; status?: string; feeBalanceCarriedForward: number };
export type PortalMark = { examName: string; subject: string; marksObtained: number; maxMarks: number; grade: string };
export type PortalNotice = { title: string; body: string; createdAt?: string };
export type PortalPayment = { id: string; amountPaid: number; paymentMethod: string; receiptNumber: string; createdAt: string };
export type PortalHoliday = { title: string; date: string; type: string };

export type PortalSummary = {
  student: PortalStudent;
  fees: PortalFees;
  marks: PortalMark[];
  notices: PortalNotice[];
  recentPayments: PortalPayment[];
  upcomingHolidays: PortalHoliday[];
};

export type PortalHomework = {
  id: string;
  title: string;
  subject: string;
  description?: string;
  dueDate?: string;
  assignedDate?: string;
};

export type PortalAttendanceSummary = { percentage?: number } & Record<string, unknown>;

async function portalGet<T>(path: string): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  if (!API_REQUESTS_AVAILABLE) throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = (await response.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? "Request failed. Please try again.");
  }
  return result as T;
}

export async function fetchSummary(studentId?: string) {
  const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
  return portalGet<{ summary: PortalSummary; linkedStudents: PortalStudent[] }>(`/api/portal/summary${qs}`);
}

export async function fetchHomework(studentId: string) {
  return portalGet<{ homework: PortalHomework[] }>(`/api/portal/homework?studentId=${encodeURIComponent(studentId)}`);
}

export async function fetchAttendance(studentId: string) {
  return portalGet<PortalAttendanceSummary>(`/api/portal/attendance?studentId=${encodeURIComponent(studentId)}`);
}

/**
 * Send a parent → school message (POST /api/portal/messages).
 * NOTE: there is currently no GET endpoint for a parent inbox; the Messages tab
 * lists school notices from the summary payload. When a thread/inbox endpoint
 * exists (Phase 5 backlog), swap it in here.
 */
export async function sendParentMessage(input: { studentId?: string; type: string; subject: string; body: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/portal/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ parentUid: user.uid, ...input })
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || result.ok === false) throw new Error(result.error ?? "Unable to send message");
  return result;
}
