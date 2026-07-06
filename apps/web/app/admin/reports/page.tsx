"use client";

import { ExportButtons } from "@/components/ExportButtons";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { DateRangeFilter } from "@/components/DateRangeFilter";
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

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { selectedYear } = useAcademicYears();
  const today = new Date();
  const [fromDate, setFromDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(isoDate(today));
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

  const loadReportData = async (reportMonth = month) => {
    if (!selectedYear?.id) {
      setAttendance([]);
      setTeachers([]);
      setSalaryReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [attendanceResult, salaryResult] = await Promise.all([
        apiRequest<AttendancePayload>(`/api/admin/attendance?${new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" })}`),
        apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(reportMonth)}`)
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
  }, [month, selectedYear?.id]);

  const filteredAttendance = attendance.filter((record) => (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate));

  return (
    <>
      <PageHeader title="Reports" description="Download Excel reports or open printable PDF reports for attendance, salary, and biometric logs." />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load reports.</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        <DateRangeFilter
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => { setFromDate(from); setToDate(to); }}
          onApply={({ from, to }) => {
            setFromDate(from);
            setToDate(to);
            const nextMonth = from ? from.slice(0, 7) : month;
            setMonth(nextMonth);
            void loadReportData(nextMonth);
          }}
          loading={loading}
        />
        <div className="card grid gap-3 p-4 md:grid-cols-3">
          <select className="field"><option>All teachers</option></select>
          <select className="field"><option>All subjects</option></select>
          <select className="field"><option>All statuses</option></select>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#7d86a8]">{loading ? "Loading report data..." : `${filteredAttendance.length} attendance rows, ${salaryReports.length} salary rows`}</p>
            <button className="btn-secondary" onClick={() => loadReportData()} disabled={loading}>Refresh</button>
          </div>
          <ExportButtons attendance={filteredAttendance} teachers={teachers} salaryReports={salaryReports} />
        </div>
      </section>
    </>
  );
}
