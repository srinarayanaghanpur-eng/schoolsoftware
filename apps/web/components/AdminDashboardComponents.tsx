/**
 * Admin Dashboard Components
 * Complete UI components for dashboard, reports, and management
 */

'use client';

import React, { useEffect, useState, memo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Workaround for mismatched React types from recharts' typings
const ResponsiveContainerAny = ResponsiveContainer as unknown as React.ComponentType<any>;
const LineChartAny = LineChart as unknown as React.ComponentType<any>;
const PieChartAny = PieChart as unknown as React.ComponentType<any>;
const CartesianGridAny = CartesianGrid as unknown as React.ComponentType<any>;
const XAxisAny = XAxis as unknown as React.ComponentType<any>;
const YAxisAny = YAxis as unknown as React.ComponentType<any>;
const TooltipAny = Tooltip as unknown as React.ComponentType<any>;
const LegendAny = Legend as unknown as React.ComponentType<any>;
const LineAny = Line as unknown as React.ComponentType<any>;
const PieAny = Pie as unknown as React.ComponentType<any>;
const CellAny = Cell as unknown as React.ComponentType<any>;

const chartLabelColor = 'hsl(var(--chart-label))';
const chartGridColor = 'hsl(var(--chart-grid))';
const chartTooltipStyle = {
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  background: 'hsl(var(--chart-tooltip))',
  color: 'hsl(var(--chart-tooltip-foreground))',
  boxShadow: '0 14px 34px rgb(0 0 0 / 0.18)',
};
const chartTooltipTextStyle = { color: 'hsl(var(--chart-tooltip-foreground))' };

// ============================================================================
// Dashboard Overview Component
// ============================================================================

export interface DashboardStats {
  today: {
    date: string;
    totalMarked: number;
    present: number;
    late: number;
    absent: number;
    notMarked: number;
  };
  monthly: {
    month: string;
    totalTeachers: number;
    averageAttendance: string;
    highestLateCount: number;
    averageLateCount: string;
  };
  casualLeave: {
    averageBalance: string;
    criticalCount: number;
    warningCount: number;
  };
  totalTeachers: number;
}

const DashboardOverviewInner: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  const attendanceData = [
    { name: 'Present', value: stats.today.present, fill: '#10b981' },
    { name: 'Late', value: stats.today.late, fill: '#f59e0b' },
    { name: 'Absent', value: stats.today.absent, fill: '#ef4444' },
    { name: 'Not Marked', value: stats.today.notMarked, fill: '#9ca3af' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Teachers Card */}
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Total Teachers</h3>
        <p className="text-3xl font-bold text-foreground dark:text-white">{stats.totalTeachers}</p>
      </div>

      {/* Present Today Card */}
      <div className="rounded-lg border border-border border-l-4 border-green-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Present Today</h3>
        <p className="text-3xl font-bold text-success dark:text-green-300">{stats.today.present}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {((stats.today.present / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Late Today Card */}
      <div className="rounded-lg border border-border border-l-4 border-yellow-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Late Today</h3>
        <p className="text-3xl font-bold text-warning dark:text-yellow-300">{stats.today.late}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {((stats.today.late / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Absent Today Card */}
      <div className="rounded-lg border border-border border-l-4 border-red-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Absent Today</h3>
        <p className="text-3xl font-bold text-destructive dark:text-rose-300">{stats.today.absent}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {((stats.today.absent / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Average Attendance Card */}
      <div className="rounded-lg border border-border border-l-4 border-blue-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Monthly Avg Attendance</h3>
        <p className="text-3xl font-bold text-accent-number dark:text-indigo-200">{stats.monthly.averageAttendance}%</p>
        <p className="mt-2 text-xs text-muted-foreground">For {stats.monthly.month}</p>
      </div>

      {/* CL Balance Card */}
      <div className="rounded-lg border border-border border-l-4 border-purple-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Avg CL Balance</h3>
        <p className="text-3xl font-bold text-accent-number dark:text-indigo-200">{stats.casualLeave.averageBalance}</p>
        <p className="mt-2 text-xs text-destructive dark:text-rose-300">
          {stats.casualLeave.criticalCount} critical
        </p>
      </div>

      {/* Highest Late Count Card */}
      <div className="rounded-lg border border-border border-l-4 border-orange-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Highest Late Count</h3>
        <p className="text-3xl font-bold text-warning dark:text-yellow-300">{stats.monthly.highestLateCount}</p>
        <p className="mt-2 text-xs text-muted-foreground">This month</p>
      </div>

      {/* Not Marked Card */}
      <div className="rounded-lg border border-border border-l-4 border-gray-500 bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Not Marked Today</h3>
        <p className="text-3xl font-bold text-foreground dark:text-white">{stats.today.notMarked}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Pending attendance
        </p>
      </div>
    </div>
  );
};

export const DashboardOverview = memo(DashboardOverviewInner);

// ============================================================================
// Attendance Chart Component
// ============================================================================

export interface AttendanceTrendData {
  date: string;
  present: number;
  late: number;
  absent: number;
}

const AttendanceTrendChartInner: React.FC<{
  data: AttendanceTrendData[];
}> = ({ data }) => {
  return (
    <div className="mb-8 rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-foreground dark:text-white">
        Attendance Trend (Last 7 Days)
      </h2>
      <div className="h-72 min-h-[280px] w-full">
        {data.length > 0 ? (
          <ResponsiveContainerAny width="100%" height="100%">
            <LineChartAny data={data}>
              <CartesianGridAny strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxisAny dataKey="date" tick={{ fill: chartLabelColor, fontSize: 12, fontWeight: 600 }} />
              <YAxisAny tick={{ fill: chartLabelColor, fontSize: 12 }} />
              <TooltipAny contentStyle={chartTooltipStyle} labelStyle={chartTooltipTextStyle} itemStyle={chartTooltipTextStyle} />
              <LegendAny />
              <LineAny
                type="monotone"
                dataKey="present"
                stroke="#10b981"
                name="Present"
                strokeWidth={2}
              />
              <LineAny
                type="monotone"
                dataKey="late"
                stroke="#f59e0b"
                name="Late"
                strokeWidth={2}
              />
              <LineAny
                type="monotone"
                dataKey="absent"
                stroke="#ef4444"
                name="Absent"
                strokeWidth={2}
              />
            </LineChartAny>
          </ResponsiveContainerAny>
        ) : (
          <div className="grid h-full place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
            No data available yet
          </div>
        )}
      </div>
    </div>
  );
};

export const AttendanceTrendChart = memo(AttendanceTrendChartInner);

// ============================================================================
// CL Balance Status Component
// ============================================================================

export interface CLStatus {
  teacherId: string;
  teacherName: string;
  balance: number;
  status: 'safe' | 'warning' | 'critical';
}

const CLBalanceStatusInner: React.FC<{ teachers: CLStatus[] }> = ({
  teachers,
}) => {
  const statusColors = {
    safe: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300',
    critical: 'bg-red-100 text-red-800 dark:bg-rose-500/15 dark:text-rose-300',
  };

  const statusIcons = {
    safe: '✓',
    warning: '!',
    critical: '⚠',
  };

  return (
    <div className="mb-8 rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-foreground dark:text-white">
        Casual Leave Balance Status
      </h2>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {teachers.map((teacher) => (
          <div
            key={teacher.teacherId}
            className="flex items-center justify-between rounded-lg bg-muted p-3 transition hover:bg-muted/80"
          >
            <div className="flex-1">
              <p className="font-medium text-foreground dark:text-white">{teacher.teacherName}</p>
              <p className="text-xs text-muted-foreground">{teacher.teacherId}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  {teacher.balance}
                </p>
                <p className="text-xs text-muted-foreground">CL days</p>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${statusColors[teacher.status]}`}
              >
                <span>{statusIcons[teacher.status]}</span>
                <span className="capitalize">{teacher.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CLBalanceStatus = memo(CLBalanceStatusInner);

// ============================================================================
// Late Attendance Report Component
// ============================================================================

export interface LateTeacherRecord {
  teacherId: string;
  teacherName: string;
  lateDaysCount: number;
  averageLateMinutes: number;
  thisMonthDates: string[];
}

const LateAttendanceReportInner: React.FC<{
  records: LateTeacherRecord[];
}> = ({ records }) => {
  const sortedRecords = [...records].sort(
    (a, b) => b.lateDaysCount - a.lateDaysCount
  );

  return (
    <div className="mb-8 rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold text-foreground dark:text-white">
        Late Attendance Report
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border bg-muted text-slate-700 dark:text-slate-300">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold">
                Teacher Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold">
                Late Days
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold">
                Avg Late Minutes
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold">
                This Month Dates
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRecords.map((record) => (
              <tr key={record.teacherId} className="hover:bg-muted/70">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground dark:text-white">
                      {record.teacherName}
                    </p>
                    <p className="text-xs text-muted-foreground">{record.teacherId}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 font-semibold text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300">
                    {record.lateDaysCount}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">
                    {record.averageLateMinutes.toFixed(1)} min
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {record.thisMonthDates.slice(0, 3).join(', ')}
                  {record.thisMonthDates.length > 3 &&
                    ` +${record.thisMonthDates.length - 3} more`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedRecords.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No late attendance records found
        </div>
      )}
    </div>
  );
};

export const LateAttendanceReport = memo(LateAttendanceReportInner);

// ============================================================================
// Salary Summary Component
// ============================================================================

export interface SalaryRecord {
  teacherId: string;
  teacherName: string;
  baseSalary: number;
  totalDeduction: number;
  netSalary: number;
  status: 'calculated' | 'approved' | 'paid';
  isPaid: boolean;
}

const SalarySummaryInner: React.FC<{ records: SalaryRecord[] }> = ({
  records,
}) => {
  const totalBaseSalary = records.reduce((sum, r) => sum + r.baseSalary, 0);
  const totalDeduction = records.reduce((sum, r) => sum + r.totalDeduction, 0);
  const totalNetSalary = records.reduce((sum, r) => sum + r.netSalary, 0);
  const paidCount = records.filter((r) => r.isPaid).length;
  const hasSalaryData = totalNetSalary > 0 || totalDeduction > 0;

  const statusBadges = {
    calculated: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
    paid: 'bg-purple-100 text-purple-800 dark:bg-indigo-500/15 dark:text-indigo-200',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Summary Cards */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Total Base Salary
          </h3>
          <p className="text-3xl font-bold text-foreground dark:text-white">
            ₹{(totalBaseSalary / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Total Deductions
          </h3>
          <p className="text-3xl font-bold text-destructive dark:text-rose-300">
            ₹{(totalDeduction / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Total Net Salary
          </h3>
          <p className="text-3xl font-bold text-success dark:text-green-300">
            ₹{(totalNetSalary / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Paid Salaries
          </h3>
          <p className="text-3xl font-bold text-accent-number dark:text-indigo-200">{paidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            out of {records.length} teachers
          </p>
        </div>
      </div>

      {/* Salary Distribution Chart */}
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-foreground dark:text-white">
          Salary Distribution
        </h3>
        <div className="h-64 min-h-[240px] w-full">
          {hasSalaryData ? (
            <ResponsiveContainerAny width="100%" height="100%">
              <PieChartAny>
                <PieAny
                  data={[
                    { name: 'Net Salary', value: totalNetSalary },
                    { name: 'Deductions', value: totalDeduction },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                    <CellAny fill="#10b981" />
                    <CellAny fill="#ef4444" />
                </PieAny>
                  <TooltipAny formatter={(value: any) => `₹${value}`} contentStyle={chartTooltipStyle} labelStyle={chartTooltipTextStyle} itemStyle={chartTooltipTextStyle} />
              </PieChartAny>
            </ResponsiveContainerAny>
          ) : (
            <div className="grid h-full place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
              No data available yet
            </div>
          )}
        </div>
      </div>

      {/* Salary Table */}
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow dark:bg-slate-900 lg:col-span-2">
        <h3 className="mb-4 text-lg font-semibold text-foreground dark:text-white">
          Teacher Salary Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold">
                  Teacher
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold">
                  Base
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold">
                  Deduction
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold">
                  Net
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.slice(0, 5).map((record) => (
                <tr key={record.teacherId} className="hover:bg-muted/70">
                  <td className="px-4 py-2">{record.teacherName}</td>
                  <td className="px-4 py-2 text-right">
                    ₹{(record.baseSalary / 1000).toFixed(1)}K
                  </td>
                  <td className="px-4 py-2 text-right text-destructive dark:text-rose-300">
                    ₹{(record.totalDeduction / 1000).toFixed(1)}K
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ₹{(record.netSalary / 1000).toFixed(1)}K
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusBadges[record.status]}`}
                    >
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length > 5 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{records.length - 5} more records
          </p>
        )}
      </div>
    </div>
  );
};

export const SalarySummary = memo(SalarySummaryInner);

// ============================================================================
// Export Component (generates CSV/PDF)
// ============================================================================

export const ExportReportButton: React.FC<{
  reportType: string;
  month?: string;
  date?: string;
}> = ({ reportType, month, date }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        format,
      });

      if (month) params.append('month', month);
      if (date) params.append('date', date);

      const response = await fetch(`/api/reports?${params.toString()}`);

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } else {
        const data = await response.json();
        // Handle PDF generation (could use jspdf library)
        console.log('PDF data:', data);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('csv')}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export CSV'}
      </button>
      <button
        onClick={() => handleExport('pdf')}
        disabled={loading}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export PDF'}
      </button>
    </div>
  );
};

export default {
  DashboardOverview,
  AttendanceTrendChart,
  CLBalanceStatus,
  LateAttendanceReport,
  SalarySummary,
  ExportReportButton,
};
