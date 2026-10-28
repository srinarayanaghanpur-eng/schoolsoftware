"use client";

import { CalendarCheck, Clock, AlertCircle } from "lucide-react";

export function AttendanceTab({
  student,
  data
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Attendance</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Attendance records for {String(student.studentName || "this student")}</p>
        </div>
      </div>

      <div className="card border-l-4 border-[#ad7413] bg-[#fff7e6] p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 text-[#ad7413]" />
          <div>
            <h3 className="text-sm font-bold text-[#1f2136]">Student Attendance Not Tracked</h3>
            <p className="mt-1 text-sm text-[#7d86a8]">
              The current ERP tracks staff attendance only. Student attendance records are not stored in the database, so there is no attendance history to display for this student.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-6 text-center border border-[#edf0f7]">
          <CalendarCheck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Working Days</p>
          <p className="text-2xl font-extrabold text-[#1f2136]">—</p>
        </div>
        <div className="card p-6 text-center border border-[#edf0f7]">
          <CalendarCheck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Present Days</p>
          <p className="text-2xl font-extrabold text-[#0f8d52]">—</p>
        </div>
        <div className="card p-6 text-center border border-[#edf0f7]">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Attendance %</p>
          <p className="text-2xl font-extrabold text-[#3033a1]">—</p>
        </div>
      </div>

      <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
        <AlertCircle size={20} className="mx-auto mb-3 opacity-50" />
        <p>No attendance records available. To enable student attendance tracking, contact your system administrator to configure the student attendance module.</p>
      </div>
    </div>
  );
}
