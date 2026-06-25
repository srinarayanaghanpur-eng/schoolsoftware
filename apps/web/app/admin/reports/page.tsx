"use client";

import { ExportButtons } from "@/components/ExportButtons";
import { PageHeader } from "@/components/PageHeader";
import { auth } from "@sri-narayana/shared/firebase/client";
import type { AttendanceRecord, SalaryReport, Teacher } from "@sri-narayana/shared";
import { useEffect, useState } from "react";

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(currentMonth());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaryReports, setSalaryReports] = useState<SalaryReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const response = await fetch(path, {
      headers: { authorization: `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attendanceResult, salaryResult] = await Promise.all([
        apiRequest<AttendancePayload>("/api/admin/attendance"),
        apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(month)}`)
      ]);
      setAttendance(attendanceResult.records);
      setTeachers(attendanceResult.teachers);
      setSalaryReports(salaryResult.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [month]);

  const filteredAttendance = attendance.filter((record) => record.month === month || record.date === date);

  return (
    <>
      <PageHeader title="Reports" description="Download Excel reports or open printable PDF reports for attendance, salary, and biometric logs." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        <div className="card grid gap-3 p-4 md:grid-cols-5">
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input className="field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <select className="field"><option>All teachers</option></select>
          <select className="field"><option>All subjects</option></select>
          <select className="field"><option>All statuses</option></select>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#7d86a8]">{loading ? "Loading report data..." : `${filteredAttendance.length} attendance rows, ${salaryReports.length} salary rows`}</p>
            <button className="btn-secondary" onClick={loadReportData} disabled={loading}>Refresh</button>
          </div>
          <ExportButtons attendance={filteredAttendance} teachers={teachers} salaryReports={salaryReports} />
        </div>
      </section>
    </>
  );
}
