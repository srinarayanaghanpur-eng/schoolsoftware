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
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Total Teachers</h3>
        <p className="text-3xl font-bold text-gray-900">{stats.totalTeachers}</p>
      </div>

      {/* Present Today Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Present Today</h3>
        <p className="text-3xl font-bold text-green-600">{stats.today.present}</p>
        <p className="text-xs text-gray-500 mt-2">
          {((stats.today.present / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Late Today Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Late Today</h3>
        <p className="text-3xl font-bold text-yellow-600">{stats.today.late}</p>
        <p className="text-xs text-gray-500 mt-2">
          {((stats.today.late / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Absent Today Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Absent Today</h3>
        <p className="text-3xl font-bold text-red-600">{stats.today.absent}</p>
        <p className="text-xs text-gray-500 mt-2">
          {((stats.today.absent / stats.today.totalMarked) * 100).toFixed(1)}% of marked
        </p>
      </div>

      {/* Average Attendance Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Monthly Avg Attendance</h3>
        <p className="text-3xl font-bold text-blue-600">{stats.monthly.averageAttendance}%</p>
        <p className="text-xs text-gray-500 mt-2">For {stats.monthly.month}</p>
      </div>

      {/* CL Balance Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Avg CL Balance</h3>
        <p className="text-3xl font-bold text-purple-600">{stats.casualLeave.averageBalance}</p>
        <p className="text-xs text-red-500 mt-2">
          {stats.casualLeave.criticalCount} critical
        </p>
      </div>

      {/* Highest Late Count Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Highest Late Count</h3>
        <p className="text-3xl font-bold text-orange-600">{stats.monthly.highestLateCount}</p>
        <p className="text-xs text-gray-500 mt-2">This month</p>
      </div>

      {/* Not Marked Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
        <h3 className="text-gray-500 text-sm font-semibold mb-2">Not Marked Today</h3>
        <p className="text-3xl font-bold text-gray-600">{stats.today.notMarked}</p>
        <p className="text-xs text-gray-500 mt-2">
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
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attendance Trend (Last 7 Days)
      </h2>
      <ResponsiveContainerAny width="100%" height={300}>
        <LineChartAny data={data}>
          <CartesianGridAny strokeDasharray="3 3" />
          <XAxisAny dataKey="date" />
          <YAxisAny />
          <TooltipAny />
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
    safe: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  };

  const statusIcons = {
    safe: '✓',
    warning: '!',
    critical: '⚠',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Casual Leave Balance Status
      </h2>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {teachers.map((teacher) => (
          <div
            key={teacher.teacherId}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900">{teacher.teacherName}</p>
              <p className="text-xs text-gray-500">{teacher.teacherId}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {teacher.balance}
                </p>
                <p className="text-xs text-gray-500">CL days</p>
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
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Late Attendance Report
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                Teacher Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                Late Days
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                Avg Late Minutes
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                This Month Dates
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedRecords.map((record) => (
              <tr key={record.teacherId} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {record.teacherName}
                    </p>
                    <p className="text-xs text-gray-500">{record.teacherId}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                    {record.lateDaysCount}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-600">
                    {record.averageLateMinutes.toFixed(1)} min
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
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
        <div className="text-center py-8 text-gray-500">
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

  const statusBadges = {
    calculated: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    paid: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Summary Cards */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Base Salary
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            ₹{(totalBaseSalary / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Deductions
          </h3>
          <p className="text-3xl font-bold text-red-600">
            ₹{(totalDeduction / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Net Salary
          </h3>
          <p className="text-3xl font-bold text-green-600">
            ₹{(totalNetSalary / 100000).toFixed(2)}L
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Paid Salaries
          </h3>
          <p className="text-3xl font-bold text-purple-600">{paidCount}</p>
          <p className="text-xs text-gray-500 mt-2">
            out of {records.length} teachers
          </p>
        </div>
      </div>

      {/* Salary Distribution Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Salary Distribution
        </h3>
        <ResponsiveContainerAny width="100%" height={200}>
          <PieChartAny>
            <PieAny
              data={[
                { name: 'Net Salary', value: totalNetSalary },
                { name: 'Deductions', value: totalDeduction },
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }: any) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
                <CellAny fill="#10b981" />
                <CellAny fill="#ef4444" />
            </PieAny>
              <TooltipAny formatter={(value: any) => `₹${value}`} />
          </PieChartAny>
        </ResponsiveContainerAny>
      </div>

      {/* Salary Table */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Teacher Salary Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
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
            <tbody className="divide-y">
              {records.slice(0, 5).map((record) => (
                <tr key={record.teacherId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{record.teacherName}</td>
                  <td className="px-4 py-2 text-right">
                    ₹{(record.baseSalary / 1000).toFixed(1)}K
                  </td>
                  <td className="px-4 py-2 text-right text-red-600">
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
          <p className="text-xs text-gray-500 mt-2">
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
