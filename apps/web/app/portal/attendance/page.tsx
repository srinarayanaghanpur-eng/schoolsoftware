"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { formatLabel } from "@sri-narayana/shared";
import { CalendarDays, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
};

type AttendanceData = {
  student: { id: string; name: string; className: string; section?: string };
  summary: { present: number; absent: number; late: number; total: number; percentage: number };
  attendance: AttendanceRecord[];
};

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  late: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  holiday: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function AttendanceView() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    adminApiRequest<{ ok: true } & AttendanceData>(`/api/portal/attendance?studentId=${encodeURIComponent(selectedChildId)}&month=${month}`)
      .then((r) => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId, month]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Attendance" description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : ""} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-7">
        <div className="flex items-center gap-2">
          {children.length > 1 && (
            <select
              className="field"
              value={selectedChildId}
              onChange={(e) => switchChild(e.target.value)}
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - Class {c.className}</option>
              ))}
            </select>
          )}
          <input
            type="month"
            className="field"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !data ? (
        <div className="p-8 text-center text-stone-400">No attendance data available.</div>
      ) : (
        <div className="space-y-4 p-4 md:p-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-500">Present</p>
                <p className="text-xl font-extrabold">{data.summary.present}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <XCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-500">Absent</p>
                <p className="text-xl font-extrabold">{data.summary.absent}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-500">Late</p>
                <p className="text-xl font-extrabold">{data.summary.late}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-500">Attendance</p>
                <p className="text-xl font-extrabold">{data.summary.percentage}%</p>
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500 dark:bg-stone-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No records for this month</td></tr>
                ) : data.attendance.map((a) => (
                  <tr key={a.id} className="border-t border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-3 font-medium">{a.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[a.status] || "bg-stone-100 text-stone-600"}`}>
                        {formatLabel(a.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{a.checkIn || "—"}</td>
                    <td className="px-4 py-3 text-stone-500">{a.checkOut || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function PortalAttendancePage() {
  return (
    <AppShell>
      <AttendanceView />
    </AppShell>
  );
}
