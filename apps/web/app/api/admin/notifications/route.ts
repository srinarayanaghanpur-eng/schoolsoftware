import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc, json } from "@/lib/apiUtils";

async function loadCollection(collectionName: string, orderField: string, limit = 50) {
  const snapshot = await adminDb().collection(collectionName).orderBy(orderField, "desc").limit(limit).get();
  return snapshot.docs.map((doc) => serializeDoc(doc));
}

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const [passwordRequests, leaveRequests, passwordResetHistory, attendanceEditAudits, notifications] = await Promise.all([
      loadCollection("password_reset_requests", "requestedAt", 100),
      loadCollection("leave_requests", "requestedAt", 100),
      loadCollection("password_reset_history", "resetAt", 50),
      loadCollection("attendance_edit_audit_logs", "editedAt", 50),
      loadCollection("admin_notifications", "createdAt", 50)
    ]);

    return json({
      ok: true,
      passwordRequests,
      leaveRequests,
      passwordResetHistory,
      attendanceEditAudits,
      notifications
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

