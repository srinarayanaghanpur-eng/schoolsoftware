import { FieldValue } from "firebase-admin/firestore";
import {
  ATTENDANCE_MISSING_WARNING,
  buildAttendanceMissingSalaryReport,
  calculateMonthlySalary,
  getSalaryPaymentBlockedReason,
  isSalaryPaymentBlocked,
  normalizeSalaryReport,
  type AttendanceRecord,
  type Holiday,
  type LeaveRequest,
  type SalaryReport,
  type Teacher
} from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { serializeDoc, startTimer, json } from "@/lib/apiUtils";
import { getSchoolSettings } from "@/lib/firestoreServer";
import { logPayrollAccessAudit, requirePayrollAccess } from "@/lib/payrollAccess";
import { writeAuditLog } from "@/lib/auditLog";

function salaryDocId(month: string, teacherId: string) {
  return `${month}_${teacherId}`;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export async function GET(req: Request) {
  const totalTimer = startTimer();
  try {
    const access = await requirePayrollAccess(req);
    if (!access.ok) return json({ ok: false, error: access.error }, { status: access.status });
    if (access.mode === "approved") {
      await logPayrollAccessAudit({
        action: "accountant_opened_payroll",
        actor: access.token,
        actorRole: access.role,
        context: access.context,
        requestId: access.request.id,
        metadata: { method: "GET", path: "/api/admin/salary" }
      });
    }

    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const db = adminDb();

    // Preview (short query): numbers for the Generate popup WITHOUT building
    // reports — active staff, month working days, elapsed days, holidays.
    // The heavy per-teacher generation still happens only on POST.
    if (new URL(req.url).searchParams.get("preview") === "1") {
      const [yearText, monthText] = month.split("-");
      const year = Number(yearText);
      const monthNumber = Number(monthText);
      const monthEndDay = new Date(year, monthNumber, 0).getDate();
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-${String(monthEndDay).padStart(2, "0")}`;
      const [staffCountSnap, existingSnap, holidaysSnap] = await Promise.all([
        db.collection("teachers").where("status", "==", "active").count().get(),
        db.collection("salary_reports").where("month", "==", month).count().get(),
        db.collection("holidays").where("date", ">=", monthStart).where("date", "<=", monthEnd).limit(100).get()
      ]);
      const holidayDates = new Set(
        holidaysSnap.docs
          .map((d) => String((d.data() as Record<string, unknown>).date ?? "").slice(0, 10))
          .filter((d) => d >= monthStart && d <= monthEnd)
      );
      const todayKey = new Date().toISOString().slice(0, 10);
      let totalWorkingDays = 0;
      let elapsedWorkingDays = 0;
      for (let day = 1; day <= monthEndDay; day++) {
        const key = `${month}-${String(day).padStart(2, "0")}`;
        const sunday = new Date(year, monthNumber - 1, day).getDay() === 0;
        if (sunday || holidayDates.has(key)) continue;
        totalWorkingDays++;
        if (key <= todayKey) elapsedWorkingDays++;
      }
      return json({
        ok: true,
        preview: {
          month,
          activeStaff: Number(staffCountSnap.data().count || 0),
          totalWorkingDays,
          elapsedWorkingDays,
          holidays: holidayDates.size,
          holidayNames: holidaysSnap.docs.map((d) => String((d.data() as Record<string, unknown>).name ?? (d.data() as Record<string, unknown>).title ?? "")).filter(Boolean).slice(0, 20),
          existingRecords: Number(existingSnap.data().count || 0)
        }
      });
    }

    const dbTimer = startTimer();
    const [snapshot, teachersSnapshot] = await Promise.all([
      db.collection("salary_reports").where("month", "==", month).limit(1000).get(),
      db.collection("teachers").where("status", "==", "active").limit(1000).get()
    ]);
    const dbMs = dbTimer();
    const activeTeachers = teachersSnapshot.docs.map((doc) => serializeDoc<Teacher>(doc));
    const activeTeacherIds = new Set(activeTeachers.map((teacher) => teacher.id));
    const activeTeacherNames = new Map(activeTeachers.map((teacher) => [teacher.id, teacher.fullName]));

    // normalizeSalaryReport recomputes deduction/netPayable from the safety
    // formula. This protects against legacy stored docs where a teacher had
    // 0 present days but netPayable was saved as full base salary — those now
    // display with the correct deduction (or "Attendance Missing"/"Invalid"
    // status) instead of the stored wrong number.
    const reports = snapshot.docs
      .map((doc) => normalizeSalaryReport(serializeDoc<SalaryReport>(doc)))
      .filter((report) => activeTeacherIds.has(report.teacherId))
      .map((report) => {
        const teacherName = activeTeacherNames.get(report.teacherId);
        return teacherName && report.teacherName !== teacherName
          ? normalizeSalaryReport({ ...report, teacherName })
          : report;
      })
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName));

    const totalMs = totalTimer();
    if (process.env.NODE_ENV === "development") console.log(`[API] /api/admin/salary GET - DB: ${dbMs}ms, Total: ${totalMs}ms, Reports: ${reports.length}, Active teachers: ${activeTeacherIds.size}`);

    return json({ ok: true, reports, _metrics: { dbMs, totalMs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load salary reports";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const totalTimer = startTimer();
  try {
    const access = await requirePayrollAccess(req);
    if (!access.ok) return json({ ok: false, error: access.error }, { status: access.status });

    const body = await req.json().catch(() => ({}));
    const month = typeof body.month === "string" && body.month ? body.month : new Date().toISOString().slice(0, 7);
    const payrollFinalized = Boolean(body.payrollFinalized);
    const db = adminDb();
    const [yearText, monthText] = month.split("-");
    const monthEndDay = new Date(Number(yearText), Number(monthText), 0).getDate();

    // Query only active teachers (moved filter to DB level) + parallelize all reads
    const dbTimer = startTimer();
    const attendancePromise = db.collection("attendance").where("month", "==", month).limit(5000).get()
      .then((snapshot) => ({ snapshot }))
      .catch(() => ({ snapshot: null }));
    const [teachersSnapshot, attendanceRead, holidaysSnapshot, leaveSnapshot, settings] = await Promise.all([
      db
        .collection("teachers")
        .where("status", "==", "active") // Filter at DB level (~90% faster than after fetch)
        .orderBy("fullName")
        .limit(5000)
        .get(),
      attendancePromise,
      db.collection("holidays").where("date", ">=", `${month}-01`).where("date", "<=", `${month}-${String(monthEndDay).padStart(2, "0")}`).limit(1000).get(),
      // Only leave that can overlap the month: startDate up to month end. The
      // in-memory endDate check below drops old leave that ended before the
      // month started (bounded far tighter than fetching every approved leave).
      db.collection("leave_requests")
        .where("status", "==", "approved")
        .where("startDate", "<=", `${month}-${String(monthEndDay).padStart(2, "0")}`)
        .orderBy("startDate", "desc")
        .limit(500)
        .get(),
      getSchoolSettings()
    ]);
    const dbMs = dbTimer();

    const teachers = teachersSnapshot.docs.map((doc) => serializeDoc<Teacher>(doc));
    const holidays = holidaysSnapshot.docs.map((doc) => serializeDoc<Holiday>(doc));
    // Keep only approved leave whose range overlaps the selected month.
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(monthEndDay).padStart(2, "0")}`;
    const leaveRequests = leaveSnapshot.docs
      .map((doc) => serializeDoc<LeaveRequest>(doc))
      .filter((leave) => (leave.startDate ?? "").slice(0, 10) <= monthEnd && (leave.endDate ?? leave.startDate ?? "").slice(0, 10) >= monthStart);

    // Group approved leave by teacher for O(1) lookup.
    const leaveByTeacherId = new Map<string, LeaveRequest[]>();
    leaveRequests.forEach((leave) => {
      if (!leaveByTeacherId.has(leave.teacherId)) leaveByTeacherId.set(leave.teacherId, []);
      leaveByTeacherId.get(leave.teacherId)!.push(leave);
    });

    const attendanceSnapshot = attendanceRead.snapshot;
    if (!attendanceSnapshot || attendanceSnapshot.size === 0) {
      const reports = teachers.map((teacher) =>
        buildAttendanceMissingSalaryReport({
          teacher,
          holidays,
          leaveRequests: leaveByTeacherId.get(teacher.id) || [],
          month,
          settings,
          payrollFinalized,
          reason: ATTENDANCE_MISSING_WARNING
        })
      );
      const totalMs = totalTimer();
      return json({
        ok: true,
        reports,
        attendanceAvailable: false,
        attendanceMissing: true,
        message: ATTENDANCE_MISSING_WARNING,
        _metrics: { dbMs, batchMs: 0, totalMs }
      });
    }

    const records = attendanceSnapshot.docs.map((doc) => serializeDoc<AttendanceRecord>(doc));

    // Pre-group records by teacherId to avoid O(n*m) filtering in loop (~70% faster)
    const recordsByTeacherId = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      if (!recordsByTeacherId.has(record.teacherId)) {
        recordsByTeacherId.set(record.teacherId, []);
      }
      recordsByTeacherId.get(record.teacherId)!.push(record);
    });

    const batch = db.batch();
    const reports = teachers.map((teacher) => {
      const previousDoc = db.collection("salary_reports").doc(salaryDocId(month, teacher.id));
      const calculated = calculateMonthlySalary({
        teacher,
        records: recordsByTeacherId.get(teacher.id) || [], // O(1) lookup vs O(n) filter
        holidays,
        leaveRequests: leaveByTeacherId.get(teacher.id) || [],
        month,
        settings,
        payrollFinalized
      });
      const report = normalizeSalaryReport(calculated);
      batch.set(previousDoc, { ...withoutUndefined(report), updatedAt: FieldValue.serverTimestamp(), generatedAt: FieldValue.serverTimestamp() }, { merge: true });
      
      // ========== SYNC CL VALUES BACK TO TEACHER DOCUMENT ==========
      // Update teacher's CL balance and tracking fields after salary calculation
      batch.set(db.collection("teachers").doc(teacher.id), {
        casualLeaveBalance: report.remainingCl,
        casualLeaveUsedThisMonth: report.totalClUsed,
        lateEntriesThisMonth: report.lateEntries,
        absentDaysThisMonth: report.absentDays,
        clResetDate: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      return report;
    });

    const batchTimer = startTimer();
    await batch.commit();
    const batchMs = batchTimer();

    const totalMs = totalTimer();
    if (process.env.NODE_ENV === "development") console.log(`[API] /api/admin/salary POST - DB: ${dbMs}ms, Batch: ${batchMs}ms, Total: ${totalMs}ms, Reports: ${reports.length}`);

    return json({ ok: true, reports, attendanceAvailable: true, message: `Generated salary for ${reports.length} teacher(s).`, _metrics: { dbMs, batchMs, totalMs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate salary";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await requirePayrollAccess(req);
    if (!access.ok) return json({ ok: false, error: access.error }, { status: access.status });

    const body = await req.json();
    const month = String(body.month ?? "");
    const teacherId = String(body.teacherId ?? "");
    const paid = Boolean(body.paid);
    if (!month || !teacherId) throw new Error("Month and teacher are required.");

    const db = adminDb();
    const teacherSnap = await db.collection("teachers").doc(teacherId).get();
    if (!teacherSnap.exists || teacherSnap.data()?.status !== "active") {
      return json({ ok: false, error: "Salary can only be updated for active staff." }, { status: 400 });
    }

    const reportRef = db.collection("salary_reports").doc(salaryDocId(month, teacherId));
    const prevSnap = await reportRef.get();
    const prevPaid = Boolean((prevSnap.data() as { paid?: boolean } | undefined)?.paid);
    if (paid) {
      if (!prevSnap.exists) {
        return json({ ok: false, error: "Salary report not found. Generate salary first." }, { status: 400 });
      }
      const report = normalizeSalaryReport(prevSnap.data() as SalaryReport);
      if (isSalaryPaymentBlocked(report)) {
        return json({ ok: false, error: getSalaryPaymentBlockedReason(report) ?? "Salary payment is blocked for this report." }, { status: 400 });
      }
    }

    await reportRef.set(
      {
        paid,
        paidAt: paid ? new Date().toISOString() : "",
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    // Payroll state change — must be attributable.
    try {
      await writeAuditLog({
        action: "salary.payment_status_changed",
        entityType: "salary_report",
        entityId: salaryDocId(month, teacherId),
        actorId: access.token.uid,
        actorRole: access.role,
        oldValues: { paid: prevPaid },
        newValues: { paid, month, teacherId }
      });
    } catch (auditError) {
      console.error("Salary PATCH: audit log write failed:", auditError);
    }

    return json({ ok: true, message: paid ? "Marked salary as paid." : "Marked salary as unpaid." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update salary";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

