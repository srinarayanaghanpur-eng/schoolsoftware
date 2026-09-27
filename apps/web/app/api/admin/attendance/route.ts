import { attendanceEditSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, requireAdminOrPrincipal, serializeDoc, startTimer, json } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { markSummaryDirty } from "@/lib/markSummaryDirty";
function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function GET(req: Request) {
  const totalTimer = startTimer();
  try {
    // Read access: admins + principal (attendance.view holders). Writes stay
    // admin-only below — the principal has approve but not edit rights.
    const decodedToken = await requireAdminOrPrincipal(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin or principal access required" }, { status: 403 });
    }

    const db = adminDb();
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const teacherId = searchParams.get("teacherId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const status = searchParams.get("status") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    // Default recent window: without any date filter Firestore returns docs in
    // storage order and the page would show ancient records. History stays
    // fully accessible via explicit dateFrom/dateTo (or teacherId) filters.
    let effectiveDateFrom = dateFrom;
    const effectiveDateTo = dateTo;
    if (!effectiveDateFrom && !effectiveDateTo && !teacherId) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      effectiveDateFrom = cutoff.toISOString().slice(0, 10);
    }

    // Use the most selective indexed field as the primary query filter.
    // All secondary filters are applied in API code to avoid composite indexes.
    let attendanceQuery: FirebaseFirestore.Query = db.collection("attendance");
    if (teacherId) {
      attendanceQuery = attendanceQuery.where("teacherId", "==", teacherId);
    } else if (academicYearId) {
      attendanceQuery = attendanceQuery.where("academicYearId", "==", academicYearId);
    } else if (schoolId) {
      attendanceQuery = attendanceQuery.where("schoolId", "==", schoolId);
    }

    if (cursor) {
      const cursorDoc = await db.collection("attendance").doc(cursor).get();
      if (cursorDoc.exists) attendanceQuery = attendanceQuery.startAfter(cursorDoc);
    }

    const dbTimer = startTimer();
    const [attendanceSnapshot, auditSnapshot] = await Promise.all([
      attendanceQuery.limit(Math.min(100, pageSize * 4) + 1).get(),
      db.collection("attendance_edit_audit_logs").orderBy("editedAt", "desc").limit(50).get()
    ]);
    const dbMs = dbTimer();
    logFirestoreRead("AttendanceAPI", "attendance", attendanceSnapshot, { academicYearId, schoolId, teacherId, dateFrom, dateTo, status, pageSize });

    // Apply remaining scope filters + secondary filters in API code
    const scopedDocs = attendanceSnapshot.docs
      .filter((doc) => {
        const data = doc.data();
        if (!teacherId && academicYearId && data.academicYearId !== academicYearId) return false;
        if (!teacherId && schoolId && data.schoolId !== schoolId) return false;
        if (effectiveDateFrom && data.date < effectiveDateFrom) return false;
        if (effectiveDateTo && data.date > effectiveDateTo) return false;
        if (status && status !== "all" && data.status !== status) return false;
        return true;
      })
      .sort((a, b) => String(b.data().date ?? "").localeCompare(String(a.data().date ?? "")));
    const attendancePageDocs = scopedDocs.slice(0, pageSize);
    const nextCursor =
      attendanceSnapshot.docs.length > Math.min(100, pageSize * 4) && attendancePageDocs.length > 0
        ? attendanceSnapshot.docs[attendanceSnapshot.docs.length - 1].id
        : null;
    const records = attendancePageDocs.map((doc) => serializeDoc(doc));
    const audits = auditSnapshot.docs.map((doc) => serializeDoc(doc));

    // Only load teachers that are referenced in the current page of records
    const uniqueTeacherIds = new Set(
      records
        .map((r: any) => r.teacherId || "")
        .filter(Boolean)
    );
    
    const teacherDocs = uniqueTeacherIds.size > 0
      ? (
          await Promise.all(
            chunk(Array.from(uniqueTeacherIds), 30).map((teacherIds) =>
              db.collection("teachers").where("__name__", "in", teacherIds).get()
            )
          )
        ).flatMap((snapshot) => snapshot.docs)
      : [];

    const totalMs = totalTimer();
    if (process.env.NODE_ENV === "development") console.log(`[API] /api/admin/attendance - DB: ${dbMs}ms, Total: ${totalMs}ms, Records: ${records.length}, Teachers: ${teacherDocs.length}, Filters: ${JSON.stringify({ teacherId, dateFrom, dateTo, status })}`);

    return json({
      ok: true,
      records,
      teachers: teacherDocs.map((doc) => serializeDoc(doc)),
      audits,
      pageSize,
      nextCursor,
      hasMore: Boolean(nextCursor),
      _metrics: { dbMs, totalMs }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load attendance";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const parsed = attendanceEditSchema.parse(await req.json());
    const db = adminDb();
    const attendanceRef = db.collection("attendance").doc(parsed.attendanceId);
    const existingSnapshot = await attendanceRef.get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() : undefined;
    const now = new Date().toISOString();
    const month = parsed.date.slice(0, 7);
    const year = Number(parsed.date.slice(0, 4));
    const sourcesUsed = Array.from(new Set([...(Array.isArray(existing?.sourcesUsed) ? existing?.sourcesUsed : []), "admin"]));
    const payload: Record<string, unknown> = {
      teacherId: parsed.teacherId,
      date: parsed.date,
      month,
      year,
      status: parsed.status,
      source: "admin",
      sourcesUsed,
      lateMinutes: parsed.lateMinutes,
      isLate: parsed.status === "late" || parsed.lateMinutes > 0,
      remarks: parsed.remarks,
      adminEdited: true,
      editedBy: decodedToken.uid,
      editReason: parsed.reason,
      createdAt: typeof existing?.createdAt === "string" ? existing.createdAt : now,
      updatedAt: now
    };

    if (parsed.checkInTime) payload.checkInTime = parsed.checkInTime;
    if (parsed.checkOutTime) payload.checkOutTime = parsed.checkOutTime;

    await db.runTransaction(async (transaction) => {
      transaction.set(attendanceRef, payload, { merge: true });
      transaction.set(db.collection("attendance_edit_audit_logs").doc(), {
        attendanceId: parsed.attendanceId,
        teacherId: parsed.teacherId,
        date: parsed.date,
        previousStatus: existing?.status ?? "",
        newStatus: parsed.status,
        reason: parsed.reason,
        editedBy: decodedToken.uid,
        editedAt: now
      });
      transaction.set(db.collection("admin_audit_logs").doc(), {
        action: "attendance_edit",
        attendanceId: parsed.attendanceId,
        teacherId: parsed.teacherId,
        date: parsed.date,
        createdAt: now,
        createdBy: decodedToken.uid,
        reason: parsed.reason
      });
    });

    return json({ ok: true, message: "Attendance updated with audit trail." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update attendance";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const attendanceId = typeof body?.attendanceId === "string" ? body.attendanceId : "";
    const teacherId = typeof body?.teacherId === "string" ? body.teacherId : "";
    const date = typeof body?.date === "string" ? body.date : "";
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "Deleted by admin";
    if (!attendanceId || !teacherId || !date) {
      return json({ ok: false, error: "attendanceId, teacherId and date are required" }, { status: 400 });
    }

    const db = adminDb();
    const attendanceRef = db.collection("attendance").doc(attendanceId);
    const existingSnapshot = await attendanceRef.get();
    if (!existingSnapshot.exists) {
      return json({ ok: false, error: "Attendance record not found" }, { status: 404 });
    }
    const existing = existingSnapshot.data();
    const now = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      transaction.delete(attendanceRef);
      transaction.set(db.collection("attendance_edit_audit_logs").doc(), {
        attendanceId,
        teacherId,
        date,
        previousStatus: existing?.status ?? "",
        newStatus: "deleted",
        reason,
        editedBy: decodedToken.uid,
        editedAt: now
      });
      transaction.set(db.collection("admin_audit_logs").doc(), {
        action: "attendance_delete",
        attendanceId,
        teacherId,
        date,
        createdAt: now,
        createdBy: decodedToken.uid,
        reason
      });
    });

    return json({ ok: true, message: "Attendance record deleted with audit trail." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete attendance";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

