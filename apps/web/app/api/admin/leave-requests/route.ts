import { NextResponse } from "next/server";
import { createAttendanceDocumentId, leaveRequestReviewSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc } from "@/lib/apiUtils";

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

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const snapshot = await adminDb().collection("leave_requests").orderBy("requestedAt", "desc").limit(100).get();
    return NextResponse.json({ ok: true, requests: snapshot.docs.map((doc) => serializeDoc(doc)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load leave requests";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const requestId = String(body.requestId ?? "").trim();
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "Request ID is required" }, { status: 400 });
    }

    const parsed = leaveRequestReviewSchema.parse(body);
    const db = adminDb();
    const requestRef = db.collection("leave_requests").doc(requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      return NextResponse.json({ ok: false, error: "Leave request not found" }, { status: 404 });
    }

    const request = requestSnapshot.data() as {
      teacherId?: string;
      teacherName?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
      status?: string;
    };
    const reviewedAt = new Date().toISOString();
    const batch = db.batch();

    batch.set(
      requestRef,
      {
        status: parsed.status,
        adminNote: parsed.adminNote,
        reviewedAt,
        reviewedBy: decodedToken.uid,
        attendanceUpdated: parsed.status === "approved"
      },
      { merge: true }
    );

    if (parsed.status === "approved" && request.teacherId && request.startDate && request.endDate) {
      for (const date of dateRange(request.startDate, request.endDate)) {
        const attendanceId = createAttendanceDocumentId(request.teacherId, date);
        const attendanceRef = db.collection("attendance").doc(attendanceId);
        const month = date.slice(0, 7);
        const year = Number(date.slice(0, 4));
        const editReason = `Leave approved${parsed.adminNote ? `: ${parsed.adminNote}` : ""}`;
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
            editedBy: decodedToken.uid,
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
          editedBy: decodedToken.uid,
          editedAt: reviewedAt
        });
      }
    }

    batch.set(db.collection("admin_audit_logs").doc(), {
      action: `leave_request_${parsed.status}`,
      requestId,
      teacherId: request.teacherId ?? "",
      createdAt: reviewedAt,
      createdBy: decodedToken.uid,
      note: parsed.adminNote
    });

    await batch.commit();
    return NextResponse.json({ ok: true, message: `Leave request ${parsed.status}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update leave request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
