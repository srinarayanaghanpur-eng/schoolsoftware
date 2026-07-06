"use client";

import { DatePicker } from "@/components/DatePicker";
import { DeclareHolidayModal } from "@/components/DeclareHolidayModal";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { auth } from "@sri-narayana/shared/firebase/client";
import { isHolidayActive, type Holiday } from "@sri-narayana/shared";
import { Ban, Plus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const blankHoliday = { title: "", date: "", type: "school" };

export default function HolidaysPage() {
  const { role } = useAdminSession();
  const isSuperAdmin = role === "super_admin";
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState(blankHoliday);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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

  const loadHolidays = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ holidays: Holiday[] }>("/api/admin/holidays");
      setHolidays(result.holidays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  const saveHoliday = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>("/api/admin/holidays", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setMessage(result.message ?? "Holiday saved.");
      setForm(blankHoliday);
      setShowForm(false);
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save holiday");
    } finally {
      setLoading(false);
    }
  };

  const cancelHoliday = async (holiday: Holiday) => {
    if (!holiday.id) return;
    if (!window.confirm(`Cancel the declared holiday on ${holiday.date}? Attendance will be required again.`)) return;
    setCancellingId(holiday.id);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>("/api/admin/holidays/declare", {
        method: "PATCH",
        body: JSON.stringify({ holidayId: holiday.id })
      });
      setMessage(result.message ?? "Holiday cancelled successfully.");
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel holiday");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Manage paid school holidays used by attendance and salary."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && <DeclareHolidayModal onDeclared={loadHolidays} />}
            <button className="btn-secondary" onClick={() => setShowForm((value) => !value)}><Plus size={16} /> Add holiday</button>
          </div>
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        {showForm && (
          <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={saveHoliday}>
            <input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Holiday title" required />
            <DatePicker value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            <select className="field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="school">School</option>
              <option value="public">Public</option>
              <option value="exam">Exam</option>
              <option value="other">Other</option>
            </select>
            <button className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Save holiday"}</button>
          </form>
        )}
        <div className="card overflow-hidden">
          {holidays.map((holiday) => {
            const isManagement = holiday.type === "management_declared";
            const active = isHolidayActive(holiday);
            return (
              <div key={holiday.id ?? holiday.date} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f7] p-4 last:border-b-0">
                <div className="min-w-0">
                  <p className={`font-bold ${active ? "text-[#303247]" : "text-[#9aa1bd] line-through"}`}>
                    {isManagement ? "Management Declared Holiday" : holiday.title}
                  </p>
                  <p className="text-sm font-medium text-[#7d86a8]">{holiday.date}</p>
                  {isManagement && (
                    <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                      Reason: {holiday.reason || holiday.title}
                      {holiday.declaredByName ? ` · Declared by ${holiday.declaredByName}` : ""}
                      {holiday.appliesToAllBranches === false && holiday.branchId ? ` · Branch: ${holiday.branchId}` : " · All branches"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isManagement && !active && (
                    <span className="rounded-full bg-[#ffebed] px-2.5 py-1 text-xs font-bold text-[#c83f4d]">Cancelled</span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${isManagement ? "bg-[#fff4df] text-[#b97e10]" : "bg-[#eef0f7] text-[#7d86a8]"}`}>
                    {isManagement ? "Management" : holiday.type}
                  </span>
                  {isSuperAdmin && isManagement && active && (
                    <button
                      className="btn-secondary"
                      onClick={() => cancelHoliday(holiday)}
                      disabled={cancellingId === holiday.id}
                    >
                      <Ban size={15} /> {cancellingId === holiday.id ? "Cancelling..." : "Cancel Holiday"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && holidays.length === 0 && <div className="p-6 text-sm font-medium text-[#7d86a8]">No holidays added yet.</div>}
        </div>
      </section>
    </>
  );
}
