"use client";

import { PageHeader } from "@/components/PageHeader";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  DEFAULT_SETTINGS,
  calculateMonthlySalary,
  demoAttendance,
  demoHolidays,
  demoTeachers,
  type SalaryReport
} from "@sri-narayana/shared";
import { CheckCircle2, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function demoReportsForMonth(month: string) {
  return demoTeachers.map((teacher) =>
    calculateMonthlySalary({
      teacher,
      records: demoAttendance.filter((record) => record.teacherId === teacher.id && record.month === month),
      holidays: demoHolidays.filter((holiday) => holiday.date.startsWith(month)),
      month,
      settings: DEFAULT_SETTINGS
    })
  );
}

export default function SalaryPage() {
  const [month, setMonth] = useState(currentMonth());
  const [reports, setReports] = useState<SalaryReport[]>(() => (isFirebaseConfigured ? [] : demoReportsForMonth(currentMonth())));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        setReports(demoReportsForMonth(month));
        setMessage("Showing demo salary reports.");
        return;
      }
      const result = await apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(month)}`);
      setReports(result.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load salary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [month]);

  const generateSalary = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setReports(demoReportsForMonth(month));
        setMessage("Demo salary generated.");
        return;
      }
      const result = await apiRequest<{ reports: SalaryReport[]; message?: string }>("/api/admin/salary", {
        method: "POST",
        body: JSON.stringify({ month })
      });
      setReports(result.reports);
      setMessage(result.message ?? "Salary generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate salary");
    } finally {
      setLoading(false);
    }
  };

  const togglePaid = async (report: SalaryReport) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const nextPaid = !report.paid;
      if (!isFirebaseConfigured) {
        setReports((items) =>
          items.map((item) =>
            item.teacherId === report.teacherId ? { ...item, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : "" } : item
          )
        );
        setMessage(nextPaid ? "Demo salary marked as paid." : "Demo salary marked as unpaid.");
        return;
      }
      const result = await apiRequest<{ message?: string }>("/api/admin/salary", {
        method: "PATCH",
        body: JSON.stringify({ month: report.month, teacherId: report.teacherId, paid: nextPaid })
      });
      setReports((items) => items.map((item) => (item.teacherId === report.teacherId ? { ...item, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : "" } : item)));
      setMessage(result.message ?? "Salary updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update salary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Salary Management" description="Generate salary from attendance, apply adjustments, and mark payment status." />
      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <input className="field max-w-xs" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <button className="btn-primary" onClick={generateSalary} disabled={loading}>
            <RotateCw size={16} /> {loading ? "Working..." : "Generate monthly salary"}
          </button>
          <button className="btn-secondary" onClick={loadReports} disabled={loading}>Refresh</button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Working</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">CL Used</th>
                <th className="px-4 py-3">CL Balance</th>
                <th className="px-4 py-3">Excess</th>
                <th className="px-4 py-3">Daily Rate</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Net Payable</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.teacherId} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">{report.teacherName}</td>
                  <td className="px-4 py-3">{report.workingDays}</td>
                  <td className="px-4 py-3">{report.presentDays}</td>
                  <td className="px-4 py-3">{report.lateEntries}</td>
                  <td className="px-4 py-3">{report.absentDays}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs">
                      {report.clUsedFromAbsent}a + {report.clUsedFromLate}l = {report.totalClUsed}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-bold ${report.remainingCl === 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>
                    {report.remainingCl}/3
                  </td>
                  <td className={`px-4 py-3 font-bold ${report.excessLeave > 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>
                    {report.excessLeave}
                  </td>
                  <td className="px-4 py-3 text-xs">₹{(report.perDaySalary ?? 0).toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 font-semibold ${(report.excessLeaveDeduction ?? 0) > 0 ? "text-red-600" : ""}`}>
                    ₹{(report.excessLeaveDeduction ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">₹{(report.baseSalary ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold">₹{(report.netPayable ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary" disabled={loading} onClick={() => togglePaid(report)}>
                      <CheckCircle2 size={15} /> {report.paid ? "Paid" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={13}>No salary reports yet. Click Generate monthly salary.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
