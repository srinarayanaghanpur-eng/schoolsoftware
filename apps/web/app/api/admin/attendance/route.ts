import { NextResponse } from "next/server";
import { attendanceEditSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc, startTimer } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

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
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const db = adminDb();
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || getSchoolId(decodedToken);
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    let attendanceQuery: FirebaseFirestore.Query = db.collection("attendance");
    if (academicYearId) attendanceQuery = attendanceQuery.where("academicYearId", "==", academicYearId);
    if (schoolId) attendanceQuery = attendanceQuery.where("schoolId", "==", schoolId);
    attendanceQuery = attendanceQuery.orderBy("date", "desc");

    if (cursor) {
      const cursorDoc = await db.collection("attendance").doc(cursor).get();
      if (cursorDoc.exists) attendanceQuery = attendanceQuery.startAfter(cursorDoc);
    }

    const dbTimer = startTimer();
    const [attendanceSnapshot, auditSnapshot] = await Promise.all([
      attendanceQuery.limit(pageSize + 1).get(),
      db.collection("attendance_edit_audit_logs").orderBy("editedAt", "desc").limit(50).get()
    ]);
    const dbMs = dbTimer();
    logFirestoreRead("AttendanceAPI", "attendance", attendanceSnapshot, { academicYearId, schoolId, pageSize });

    const attendancePageDocs = attendanceSnapshot.docs.slice(0, pageSize);
    const nextCursor =
      attendanceSnapshot.docs.length > pageSize && attendancePageDocs.length > 0
        ? attendancePageDocs[attendancePageDocs.length - 1].id
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
    console.log(`[API] /api/admin/attendance - DB: ${dbMs}ms, Total: ${totalMs}ms, Records: ${records.length}, Teachers: ${teacherDocs.length}`);

    return NextResponse.json({
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
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
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

    return NextResponse.json({ ok: true, message: "Attendance updated with audit trail." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
