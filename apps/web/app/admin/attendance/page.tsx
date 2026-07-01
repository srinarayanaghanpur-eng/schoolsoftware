"use client";

import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter, formatDateForDisplay } from "@/components/DateRangeFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  createAttendanceDocumentId,
  demoAttendance,
  demoAttendanceEditAudits,
  demoTeachers,
  type AttendanceEditAudit,
  type AttendanceRecord,
  type AttendanceStatus,
  type Teacher
} from "@sri-narayana/shared";
import { ClipboardList, Pencil, Save, Search, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
  audits: AttendanceEditAudit[];
};

type EditForm = {
  attendanceId: string;
  teacherId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  lateMinutes: string;
  remarks: string;
  reason: string;
};

const statuses: AttendanceStatus[] = ["present", "late", "cl", "holiday", "absent", "not_marked"];

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function createEditForm(record: AttendanceRecord): EditForm {
  return {
    attendanceId: createAttendanceDocumentId(record.teacherId, record.date),
    teacherId: record.teacherId,
    date: record.date,
    status: record.status,
    checkInTime: toDatetimeLocal(record.checkInTime),
    checkOutTime: toDatetimeLocal(record.checkOutTime),
    lateMinutes: String(record.lateMinutes ?? 0),
    remarks: record.remarks ?? "",
    reason: ""
  };
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>(isFirebaseConfigured ? [] : demoAttendance);
  const [teachers, setTeachers] = useState<Teacher[]>(isFirebaseConfigured ? [] : demoTeachers);
  const [audits, setAudits] = useState<AttendanceEditAudit[]>(isFirebaseConfigured ? [] : demoAttendanceEditAudits);
  const [statusFilter, setStatusFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const statusMatch = statusFilter === "all" || record.status === statusFilter;
      const teacherMatch = teacherFilter === "all" || record.teacherId === teacherFilter;
      const dateMatch = (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate);
      const teacher = teachers.find((t) => t.id === record.teacherId);
      const searchMatch =
        searchQuery === "" ||
        record.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.teacherId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (teacher?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (teacher?.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        record.status.toLowerCase().includes(searchQuery.toLowerCase());
      return statusMatch && teacherMatch && dateMatch && searchMatch;
    });
  }, [records, teachers, statusFilter, teacherFilter, fromDate, toDate, searchQuery]);

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

  const loadAttendance = async () => {
    if (!isFirebaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<AttendancePayload>("/api/admin/attendance");
      setRecords(result.records);
      setTeachers(result.teachers);
      setAudits(result.audits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, []);

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const payload = {
      ...editing,
      checkInTime: fromDatetimeLocal(editing.checkInTime),
      checkOutTime: fromDatetimeLocal(editing.checkOutTime),
      lateMinutes: Number(editing.lateMinutes || 0)
    };

    try {
      if (!isFirebaseConfigured) {
        setRecords((items) =>
          items.map((record) =>
            createAttendanceDocumentId(record.teacherId, record.date) === editing.attendanceId
              ? {
                  ...record,
                  status: editing.status,
                  checkInTime: payload.checkInTime || undefined,
                  checkOutTime: payload.checkOutTime || undefined,
                  lateMinutes: payload.lateMinutes,
                  isLate: editing.status === "late" || payload.lateMinutes > 0,
                  remarks: editing.remarks,
                  adminEdited: true,
                  editReason: editing.reason,
                  editedBy: "admin_demo",
                  updatedAt: new Date().toISOString()
                }
              : record
          )
        );
        setAudits((items) => [
          {
            id: `demo_audit_${Date.now()}`,
            attendanceId: editing.attendanceId,
            teacherId: editing.teacherId,
            date: editing.date,
            newStatus: editing.status,
            reason: editing.reason,
            editedBy: "admin_demo",
            editedAt: new Date().toISOString()
          },
          ...items
        ]);
        setEditing(null);
        setMessage("Demo attendance edit saved with audit reason.");
        return;
      }

      const result = await apiRequest<{ message?: string }>("/api/admin/attendance", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditing(null);
      setMessage(result.message ?? "Attendance updated.");
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update attendance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Attendance Records" description="Review, filter, and manually override attendance with a required audit reason." />
      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        <div className="card grid gap-3 p-4 md:grid-cols-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input
              className="field pl-10"
              placeholder="Search by date, teacher ID, name, subject, or status"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <select className="field" value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
            <option value="all">All teachers</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select>
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="btn-secondary" onClick={loadAttendance} disabled={loading}>
            <ClipboardList size={16} /> {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <DateRangeFilter
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => { setFromDate(from); setToDate(to); }}
          onApply={({ from, to }) => { setFromDate(from); setToDate(to); }}
          loading={loading}
        />

        {editing && (
          <form onSubmit={submitEdit} className="card p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[#1f2136]">Edit attendance</h2>
                <p className="text-sm font-medium text-[#7d86a8]">{teachers.find((teacher) => teacher.id === editing.teacherId)?.fullName ?? editing.teacherId} · {editing.date}</p>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select className="field" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as AttendanceStatus })}>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input className="field" type="datetime-local" value={editing.checkInTime} onChange={(event) => setEditing({ ...editing, checkInTime: event.target.value })} />
              <input className="field" type="datetime-local" value={editing.checkOutTime} onChange={(event) => setEditing({ ...editing, checkOutTime: event.target.value })} />
              <input className="field" type="number" min="0" value={editing.lateMinutes} onChange={(event) => setEditing({ ...editing, lateMinutes: event.target.value })} placeholder="Late minutes" />
              <input className="field" value={editing.remarks} onChange={(event) => setEditing({ ...editing, remarks: event.target.value })} placeholder="Remarks" />
              <input className="field" value={editing.reason} onChange={(event) => setEditing({ ...editing, reason: event.target.value })} placeholder="Audit reason" required />
            </div>
            <button className="btn-primary mt-4" disabled={loading}>
              <Save size={16} /> Save audited edit
            </button>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Audit</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const teacher = teachers.find((item) => item.id === record.teacherId);
                const attendanceId = createAttendanceDocumentId(record.teacherId, record.date);
                return (
                  <tr key={attendanceId} className="border-t border-stone-100">
                    <td className="px-4 py-3">{formatDateForDisplay(record.date) || record.date}</td>
                    <td className="px-4 py-3 font-medium">{teacher?.fullName ?? record.teacherId}</td>
                    <td className="px-4 py-3">{teacher?.subject ?? "--"}</td>
                    <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                    <td className="px-4 py-3">{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : "-"}</td>
                    <td className="px-4 py-3">{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : "-"}</td>
                    <td className="px-4 py-3">{record.sourcesUsed.join(", ")}</td>
                    <td className="px-4 py-3">{record.lateMinutes} min</td>
                    <td className="px-4 py-3">{record.adminEdited ? record.editReason ?? "Edited" : "--"}</td>
                    <td className="px-4 py-3"><button className="btn-secondary" onClick={() => setEditing(createEditForm(record))}><Pencil size={15} /> Edit</button></td>
                  </tr>
                );
              })}
              {!filteredRecords.length && <tr><td className="px-4 py-8 text-center text-sm font-medium text-[#7d86a8]" colSpan={10}>No attendance records found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <div className="border-b border-stone-100 px-4 py-3 font-semibold">Recent attendance edit audit</div>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Teacher ID</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Admin</th></tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id ?? `${audit.attendanceId}_${audit.editedAt}`} className="border-t border-stone-100">
                  <td className="px-4 py-3">{formatDateForDisplay(audit.date) || audit.date}</td>
                  <td className="px-4 py-3">{audit.teacherId}</td>
                  <td className="px-4 py-3">{audit.previousStatus ? `${audit.previousStatus} -> ${audit.newStatus}` : audit.newStatus}</td>
                  <td className="px-4 py-3">{audit.reason}</td>
                  <td className="px-4 py-3">{audit.editedBy}</td>
                </tr>
              ))}
              {!audits.length && <tr><td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={5}>No audit entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
