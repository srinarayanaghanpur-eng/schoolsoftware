"use client";

import { PageHeader } from "@/components/PageHeader";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  calculateMonthlySalary,
  demoAttendance,
  demoHolidays,
  demoTeachers,
  type SalaryReport,
  type Teacher,
  type AttendanceRecord,
  DEFAULT_SETTINGS
} from "@sri-narayana/shared";
import { ArrowLeft, TrendingUp, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SalaryMonthData = {
  report: SalaryReport;
  teacher: Teacher;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function approvedPaidCLDays(report: SalaryReport) {
  return report.approvedPaidCLDays ?? report.paidCLDays ?? report.paidLeaveDays ?? report.clDays ?? 0;
}

function unpaidAbsentDays(report: SalaryReport) {
  return report.unpaidAbsentDays ?? report.unpaidDeductionDays ?? report.absentDays ?? 0;
}

export default function TeacherSalaryPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [salary, setSalary] = useState<SalaryMonthData | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in again.");
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

  useEffect(() => {
    const loadSalary = async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherResult, salaryResult] = await Promise.all([
          apiRequest<{ teacher: Teacher }>("/api/teacher/me"),
          apiRequest<{ reports: SalaryReport[] }>(`/api/teacher/salary?month=${encodeURIComponent(month)}`)
        ]);

        setTeacher(teacherResult.teacher);

        const report = salaryResult.reports.find((r) => r.month === month);
        if (report) {
          setSalary({ report, teacher: teacherResult.teacher });
        } else if (!isFirebaseConfigured) {
          // Demo mode
          const demoTeacher = demoTeachers[0];
          const demoRecords = demoAttendance.filter(
            (r) => r.teacherId === demoTeacher.id && r.month === month
          );
          const demoReport = calculateMonthlySalary({
            teacher: demoTeacher,
            records: demoRecords,
            holidays: demoHolidays.filter((h) => h.date.startsWith(month)),
            month,
            settings: DEFAULT_SETTINGS
          });
          setSalary({ report: demoReport, teacher: demoTeacher });
        } else {
          setSalary(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load salary");
      } finally {
        setLoading(false);
      }
    };

    void loadSalary();
  }, [month]);

  if (loading) {
    return (
      <>
        <PageHeader title="Salary Details" description="View your monthly salary breakdown." />
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-md bg-stone-100 px-4 py-6 text-center text-stone-600">Loading...</div>
        </section>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Salary Details" description="View your monthly salary breakdown." />
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          <button className="btn-secondary" onClick={() => router.back()}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </section>
      </>
    );
  }

  if (!salary) {
    return (
      <>
        <PageHeader title="Salary Details" description="View your monthly salary breakdown." />
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-md bg-stone-100 px-4 py-6 text-center text-stone-600">
            No salary report available for {month}. Please wait for the admin to generate salary.
          </div>
        </section>
      </>
    );
  }

  const { report } = salary;
  const totalWorkingDays = report.totalWorkingDaysInMonth ?? report.workingDays;
  const workingDaysElapsed = report.workingDaysElapsed ?? report.workingDays;
  const paidCLDays = approvedPaidCLDays(report);
  const unpaidDays = unpaidAbsentDays(report);
  const attendancePercentage = workingDaysElapsed > 0 ? Math.round((report.presentDays / workingDaysElapsed) * 100) : 0;
  const money = (value?: number) => (value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader title="Salary Details" description={`Monthly breakdown for ${month}`} />
      <section className="space-y-6 p-4 md:p-6">
        {/* Month Selector */}
        <div className="card flex items-center gap-3 p-4">
          <input className="field max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {/* Salary Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Base Salary */}
          <div className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">Base Salary</span>
              <Wallet size={18} className="text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-600">₹{money(report.baseSalary)}</div>
            <div className="text-xs text-stone-500">{totalWorkingDays} total working days</div>
          </div>

          {/* Daily Rate */}
          <div className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">Daily Rate</span>
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600">₹{money(report.perDaySalary)}</div>
            <div className="text-xs text-stone-500">Per working day</div>
          </div>

          {/* Net Payable */}
          <div className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">Net Payable</span>
              <Wallet size={18} className={report.netPayable > 0 ? "text-green-600" : "text-red-600"} />
            </div>
            <div className={`text-3xl font-bold ${report.netPayable > 0 ? "text-green-600" : "text-red-600"}`}>
              ₹{money(report.netPayable)}
            </div>
            <div className="text-xs text-stone-500">{report.earnedPaidDays ?? report.presentDays + paidCLDays} earned paid days</div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="card space-y-4 p-4">
          <h3 className="font-semibold">Attendance Summary</h3>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 rounded-md bg-stone-50 p-3">
              <span className="text-xs font-medium text-stone-600">Total Working Days</span>
              <div className="text-2xl font-bold">{totalWorkingDays}</div>
            </div>
            <div className="space-y-2 rounded-md bg-stone-50 p-3">
              <span className="text-xs font-medium text-stone-600">Working Days Elapsed</span>
              <div className="text-2xl font-bold">{workingDaysElapsed}</div>
            </div>
            <div className="space-y-2 rounded-md bg-green-50 p-3">
              <span className="text-xs font-medium text-green-600">Present Days</span>
              <div className="text-2xl font-bold text-green-600">{report.presentDays} ({attendancePercentage}%)</div>
            </div>
            <div className="space-y-2 rounded-md bg-blue-50 p-3">
              <span className="text-xs font-medium text-blue-600">Approved Paid CL Days</span>
              <div className="text-2xl font-bold text-blue-600">{paidCLDays}</div>
            </div>
            <div className="space-y-2 rounded-md bg-red-50 p-3">
              <span className="text-xs font-medium text-red-600">Unpaid Absent Days</span>
              <div className="text-2xl font-bold text-red-600">{unpaidDays}</div>
            </div>
          </div>
        </div>

        {/* Casual Leave Breakdown */}
        <div className="card space-y-4 p-4">
          <h3 className="font-semibold">Casual Leave (CL) Breakdown</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 rounded-md bg-blue-50 p-3">
              <span className="text-xs font-medium text-blue-600">Allowance</span>
              <div className="text-2xl font-bold text-blue-600">{report.clAllowanceThisMonth}</div>
              <span className="text-xs text-stone-500">Per month</span>
            </div>
            <div className="space-y-2 rounded-md bg-orange-50 p-3">
              <span className="text-xs font-medium text-orange-600">Approved Paid CL</span>
              <div className="text-2xl font-bold text-orange-600">{paidCLDays}</div>
              <span className="text-xs text-stone-500">{report.approvedLeaveCLDays ?? paidCLDays} approved</span>
            </div>
            <div className={`space-y-2 rounded-md p-3 ${report.remainingCl > 0 ? "bg-green-50" : "bg-gray-50"}`}>
              <span className={`text-xs font-medium ${report.remainingCl > 0 ? "text-green-600" : "text-gray-600"}`}>CL Remaining</span>
              <div className={`text-2xl font-bold ${report.remainingCl > 0 ? "text-green-600" : "text-gray-600"}`}>{report.remainingCl}</div>
              <span className="text-xs text-stone-500">Available</span>
            </div>
            <div className={`space-y-2 rounded-md p-3 ${report.excessLeave > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <span className={`text-xs font-medium ${report.excessLeave > 0 ? "text-red-600" : "text-green-600"}`}>Excess Leave</span>
              <div className={`text-2xl font-bold ${report.excessLeave > 0 ? "text-red-600" : "text-green-600"}`}>{report.excessLeave}</div>
              <span className="text-xs text-stone-500">Beyond allowance</span>
            </div>
          </div>
        </div>

        {/* Salary Deductions */}
        {(report.salaryDeduction > 0 || report.manualDeduction > 0) && (
          <div className="card space-y-4 border-l-4 border-red-500 p-4">
            <h3 className="font-semibold text-red-600">Salary Deductions</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-red-50 p-3">
                <span className="text-sm">Deduction ({unpaidDays} days × ₹{money(report.perDaySalary)})</span>
                <span className="font-semibold text-red-600">₹{money(report.salaryDeduction)}</span>
              </div>
              {report.manualDeduction > 0 && (
                <div className="flex items-center justify-between rounded-md bg-red-50 p-3">
                  <span className="text-sm">Manual Deduction</span>
                  <span className="font-semibold text-red-600">- ₹{money(report.manualDeduction)}</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-md bg-red-100 p-3">
                <span className="font-semibold">Total Deductions</span>
                <span className="text-lg font-bold text-red-600">- ₹{money(report.totalDeduction)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Final Salary Calculation */}
        <div className="card space-y-3 border-l-4 border-green-500 p-4">
          <h3 className="font-semibold text-green-600">Final Salary Calculation</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Base Salary</span>
              <span className="font-semibold">₹{money(report.baseSalary)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Working Days</span>
              <span className="font-semibold">{totalWorkingDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Working Days Elapsed</span>
              <span className="font-semibold">{workingDaysElapsed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Present Days</span>
              <span className="font-semibold">{report.presentDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Approved Paid CL Days</span>
              <span className="font-semibold">{paidCLDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unpaid Absent Days</span>
              <span className="font-semibold">{unpaidDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Daily Rate</span>
              <span className="font-semibold">₹{money(report.perDaySalary)}</span>
            </div>
            <div className={`flex items-center justify-between ${report.salaryDeduction > 0 ? "text-red-600" : ""}`}>
              <span>Deduction</span>
              <span className="font-semibold">₹{money(report.salaryDeduction)}</span>
            </div>
            {report.bonus > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Bonus</span>
                <span className="font-semibold">+ ₹{money(report.bonus)}</span>
              </div>
            )}
            <div className="border-t-2 border-stone-200 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Net Payable</span>
                <span className="text-2xl font-bold text-green-600">₹{money(report.netPayable)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div className={`card p-4 ${report.paid ? "border-l-4 border-green-500" : "border-l-4 border-yellow-500"}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Payment Status</h3>
              <p className="text-sm text-stone-600">{report.paidAt ? `Paid on ${new Date(report.paidAt).toLocaleDateString("en-IN")}` : "Pending payment"}</p>
            </div>
            <div className={`rounded-full px-4 py-2 text-sm font-semibold ${report.paid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {report.paid ? "✓ Paid" : "Pending"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-stone-500">
          <p>Generated on {new Date(report.generatedAt).toLocaleDateString("en-IN")} at {new Date(report.generatedAt).toLocaleTimeString("en-IN")}</p>
        </div>
      </section>
    </>
  );
}
