import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
import { readLimit } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

// GET /api/admin/reports/academic?type=student-directory|attendance-summary|exam-results
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });
    if (isFirestoreQuotaPaused()) return firestoreQuotaResponse();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "student-directory";
    const academicYearId = searchParams.get("academicYearId") || "";
    const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
    const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const limit = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 1000, 5000);
    const db = adminDb();

    let students: Array<Record<string, unknown> & { id: string }> = [];
    if (type !== "attendance-summary") {
      let query: FirebaseFirestore.Query = db.collection("students");
      if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
      if (classFilter) query = query.where("class", "==", classFilter);
      if (sectionFilter) query = query.where("section", "==", sectionFilter);
      const snap = await query.limit(limit).get();
      students = snap.docs
        .map((doc): Record<string, unknown> & { id: string } => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
        .filter((student) => student.status !== "archived");
    }

    if (type === "attendance-summary") {
      if (!from || !to) return json({ ok: false, error: "from and to dates are required" }, { status: 400 });
      let query: FirebaseFirestore.Query = db
        .collection("student_attendance")
        .where("date", ">=", from)
        .where("date", "<=", to);
      const snap = await query.limit(Math.min(limit * 10, 50000)).get();
      const byStudent = new Map<string, { name: string; admissionNumber: string; className: string; section: string; present: number; absent: number; late: number; halfDay: number; leave: number; holiday: number }>();
      for (const doc of snap.docs) {
        const record = doc.data() as Record<string, unknown>;
        if (classFilter && text(record.class) !== classFilter) continue;
        if (sectionFilter && text(record.section) !== sectionFilter) continue;
        const id = text(record.studentId) || doc.id.replace(/^\d{4}-\d{2}-\d{2}_/, "");
        const row = byStudent.get(id) || {
          name: text(record.studentName),
          admissionNumber: text(record.admissionNumber),
          className: text(record.class),
          section: text(record.section),
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          leave: 0,
          holiday: 0
        };
        const status = text(record.status);
        if (status === "present") row.present += 1;
        else if (status === "absent") row.absent += 1;
        else if (status === "late") row.late += 1;
        else if (status === "half_day") row.halfDay += 1;
        else if (status === "leave") row.leave += 1;
        else if (status === "holiday") row.holiday += 1;
        byStudent.set(id, row);
      }
      const rows: Row[] = Array.from(byStudent.entries())
        .map(([studentId, row]) => {
          const workingDays = row.present + row.absent + row.late + row.halfDay + row.leave;
          const attended = row.present + row.late + row.halfDay * 0.5;
          return {
            admissionNo: row.admissionNumber || studentId,
            student: row.name,
            class: row.className,
            section: row.section,
            present: row.present,
            absent: row.absent,
            late: row.late,
            leave: row.leave,
            workingDays,
            attendancePercent: percent(attended, workingDays)
          };
        })
        .sort((a, b) => text(a.class).localeCompare(text(b.class)) || text(a.student).localeCompare(text(b.student)));
      return json({ ok: true, rows, truncated: snap.size >= Math.min(limit * 10, 50000) });
    }

    if (type === "exam-results") {
      let examQuery: FirebaseFirestore.Query = db.collection("exams");
      if (academicYearId) examQuery = examQuery.where("academicYearId", "==", academicYearId);
      if (classFilter) examQuery = examQuery.where("className", "==", classFilter);
      const exams = (await examQuery.limit(12).get()).docs
        .map((doc): Record<string, unknown> & { id: string } => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
        .filter((exam) => !sectionFilter || text(exam.section) === sectionFilter || !text(exam.section));
      const nameById = new Map(students.map((student) => [student.id, text(student.studentName || student.name)]));
      const rows: Row[] = [];
      for (const exam of exams) {
        const marksSnap = await db.collection("exam_marks").where("examId", "==", exam.id).limit(1000).get();
        for (const doc of marksSnap.docs) {
          const mark = doc.data() as Record<string, unknown>;
          const marks = Number(mark.marksObtained || 0);
          const maxMarks = Number(mark.maxMarks || 0);
          rows.push({
            exam: text(exam.name),
            student: nameById.get(text(mark.studentId)) || text(mark.studentId),
            subject: text(mark.subject),
            marks,
            maxMarks,
            grade: text(mark.grade),
            percent: maxMarks > 0 ? Math.round((marks / maxMarks) * 1000) / 10 : 0
          });
        }
      }
      return json({ ok: true, rows, truncated: exams.length >= 12 });
    }

    const rows: Row[] = students
      .sort((a, b) => text(a.class).localeCompare(text(b.class)) || text(a.section).localeCompare(text(b.section)) || text(a.studentName).localeCompare(text(b.studentName)))
      .map((student) => ({
        admissionNo: text(student.admissionNumber),
        student: text(student.studentName || student.name),
        class: text(student.class),
        section: text(student.section),
        roll: text(student.rollNumber || student.rollNo),
        gender: text(student.gender),
        dob: text(student.dateOfBirth || student.dob),
        father: text(student.fatherName),
        mother: text(student.motherName),
        phone: text(student.phone || student.fatherPhone),
        address: text(student.address)
      }));
    return json({ ok: true, rows, truncated: students.length >= limit });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed to generate report" }, { status: 500 });
  }
}
