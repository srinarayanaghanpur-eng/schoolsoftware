"use client";

import { DatePicker } from "@/components/DatePicker";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { demoLeaveRequests, type LeaveRequest } from "@sri-narayana/shared";
import { ClipboardCheck, Send } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const today = new Date().toISOString().slice(0, 10);

export function TeacherLeaveRequestPanel({ teacherId }: { teacherId: string }) {
  const [requests, setRequests] = useState<LeaveRequest[]>(
    isFirebaseConfigured ? [] : demoLeaveRequests.filter((request) => request.teacherId === teacherId)
  );
  const [form, setForm] = useState({ startDate: today, endDate: today, reason: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const loadRequests = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const result = await apiRequest<{ requests: LeaveRequest[] }>("/api/leave-requests");
      setRequests(result.requests);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load leave requests");
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const submitLeave = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        const demoRequest: LeaveRequest = {
          id: `demo_leave_${Date.now()}`,
          teacherId,
          teacherName: "Demo teacher",
          employeeId: "DEMO",
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason,
          status: "pending",
          requestedAt: new Date().toISOString()
        };
        setRequests((items) => [demoRequest, ...items]);
        setForm({ startDate: today, endDate: today, reason: "" });
        setMessage("Demo leave request added.");
        return;
      }

      const result = await apiRequest<{ message?: string }>("/api/leave-requests", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ startDate: today, endDate: today, reason: "" });
      setMessage(result.message ?? "Leave request sent to admin.");
      await loadRequests();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <ClipboardCheck size={18} /> Leave request
      </div>
      <form onSubmit={submitLeave} className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
        <DatePicker value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
        <DatePicker value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
        <input className="field" placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required />
        <button className="btn-primary" disabled={loading}>
          <Send size={16} /> {loading ? "Sending..." : "Send"}
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-stone-600">{message}</p>}
      <div className="mt-4 space-y-2">
        {requests.slice(0, 4).map((request) => (
          <div key={request.id ?? `${request.startDate}_${request.reason}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
            <span>{request.startDate} to {request.endDate}</span>
            <span className="text-stone-500">{request.reason}</span>
            <span className={request.status === "approved" ? "font-semibold text-emerald-700" : request.status === "rejected" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>
              {request.status}
            </span>
          </div>
        ))}
        {!requests.length && <p className="text-sm text-stone-500">No leave requests yet.</p>}
      </div>
    </div>
  );
}
