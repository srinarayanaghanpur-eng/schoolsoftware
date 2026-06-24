"use client";

import { PageHeader } from "@/components/PageHeader";
import { auth } from "@sri-narayana/shared/firebase/client";
import type { Holiday } from "@sri-narayana/shared";
import { Plus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const blankHoliday = { title: "", date: "", type: "school" };

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState(blankHoliday);
  const [showForm, setShowForm] = useState(false);
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

  return (
    <>
      <PageHeader title="Holidays" description="Manage paid school holidays used by attendance and salary." action={<button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={16} /> Add holiday</button>} />
      <section className="space-y-4 p-4 md:p-6">
        {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>}
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {showForm && (
          <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={saveHoliday}>
            <input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Holiday title" required />
            <input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
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
          {holidays.map((holiday) => (
            <div key={holiday.id ?? holiday.date} className="flex items-center justify-between border-b border-stone-100 p-4 last:border-b-0">
              <div>
                <p className="font-medium">{holiday.title}</p>
                <p className="text-sm text-stone-500">{holiday.date}</p>
              </div>
              <span className="rounded bg-stone-100 px-2 py-1 text-xs capitalize text-stone-600">{holiday.type}</span>
            </div>
          ))}
          {!loading && holidays.length === 0 && <div className="p-6 text-sm text-stone-500">No holidays added yet.</div>}
        </div>
      </section>
    </>
  );
}
