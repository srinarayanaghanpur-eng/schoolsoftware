import type { Firestore } from "firebase-admin/firestore";
import { createAttendanceDocumentId } from "@sri-narayana/shared";

function dateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

type LeaveRequestDoc = {
  teacherId?: string;
  teacherName?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
};

/**
 * Apply an admin review decision to a leave request. When approved, marks the
 * covered attendance days as casual leave ("cl") and writes an audit log for
 * each. Shared by the legacy /api/admin/leave-requests route and the unified
 * communication requests endpoint so the side effects never diverge.
 */
export async function reviewLeaveRequest(
  db: Firestore,
  requestId: string,
  status: "approved" | "rejected",
  adminNote: string,
  reviewerUid: string
): Promise<{ ok: boolean; error?: string }> {
  const requestRef = db.collection("leave_requests").doc(requestId);
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) {
    return { ok: false, error: "Leave request not found" };
  }

  const request = requestSnapshot.data() as LeaveRequestDoc;
  const reviewedAt = new Date().toISOString();
  const batch = db.batch();

  batch.set(
    requestRef,
    {
      status,
      adminNote,
      reviewedAt,
      reviewedBy: reviewerUid,
      attendanceUpdated: status === "approved",
      updatedAt: reviewedAt,
      updatedBy: reviewerUid
    },
    { merge: true }
  );

  if (status === "approved" && request.teacherId && request.startDate && request.endDate) {
    for (const date of dateRange(request.startDate, request.endDate)) {
      const attendanceId = createAttendanceDocumentId(request.teacherId, date);
      const attendanceRef = db.collection("attendance").doc(attendanceId);
      const month = date.slice(0, 7);
      const year = Number(date.slice(0, 4));
      const editReason = `Leave approved${adminNote ? `: ${adminNote}` : ""}`;
      batch.set(
        attendanceRef,
        {
          teacherId: request.teacherId,
          date,
          month,
          year,
          status: "cl",
          source: "admin",
          sourcesUsed: ["admin"],
          lateMinutes: 0,
          isLate: false,
          remarks: request.reason ?? "Approved leave",
          adminEdited: true,
          editedBy: reviewerUid,
          editReason,
          createdAt: reviewedAt,
          updatedAt: reviewedAt
        },
        { merge: true }
      );
      batch.set(db.collection("attendance_edit_audit_logs").doc(), {
        attendanceId,
        teacherId: request.teacherId,
        date,
        newStatus: "cl",
        reason: editReason,
        editedBy: reviewerUid,
        editedAt: reviewedAt
      });
    }
  }

  batch.set(db.collection("admin_audit_logs").doc(), {
    action: `leave_request_${status}`,
    requestId,
    teacherId: request.teacherId ?? "",
    createdAt: reviewedAt,
    createdBy: reviewerUid,
    note: adminNote
  });

  await batch.commit();
  return { ok: true };
}
