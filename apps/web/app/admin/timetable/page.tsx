"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Entry = {
  id: string;
  className: string;
  section?: string;
  academicYearId: string;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName?: string;
  room?: string;
  isBreak?: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptyForm = {
  dayOfWeek: 1,
  periodNumber: 1,
  startTime: "09:00",
  endTime: "09:45",
  subject: "",
  teacherName: "",
  room: "",
  isBreak: false,
};

export default function TimetablePage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [editing, setEditing] = useState<{ entry?: Entry; day?: number; period?: number } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const maxPeriod = Math.max(...entries.map((e) => e.periodNumber), 0);

  const load = useCallback(async () => {
    if (!selectedYear?.id || !className) { setEntries([]); setLoading(false); return; }
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, className });
      if (section) params.set("section", section);
      const data = await adminApiRequest<{ entries: Entry[] }>(`/api/admin/timetable?${params}`);
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear?.id, className, section]);

  useEffect(() => { void load(); }, [load]);

  const entriesByDayPeriod: Record<string, Entry> = {};
  entries.forEach((e) => {
    entriesByDayPeriod[`${e.dayOfWeek}-${e.periodNumber}`] = e;
  });

  const periods = Array.from({ length: Math.max(maxPeriod, 6) }, (_, i) => i + 1);

  const openAdd = (day: number, period: number) => {
    setForm({ ...emptyForm, dayOfWeek: day, periodNumber: period });
    setEditing({ day, period });
  };

  const openEdit = (entry: Entry) => {
    setForm({
      dayOfWeek: entry.dayOfWeek,
      periodNumber: entry.periodNumber,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subject: entry.subject,
      teacherName: entry.teacherName || "",
      room: entry.room || "",
      isBreak: entry.isBreak || false,
    });
    setEditing({ entry });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing?.entry) {
        await adminApiRequest(`/api/admin/timetable/${editing.entry.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        await adminApiRequest("/api/admin/timetable", {
          method: "POST",
          body: JSON.stringify({ ...form, className, section: section || "", academicYearId: selectedYear?.id || "" }),
        });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this timetable entry?")) return;
    try {
      await adminApiRequest(`/api/admin/timetable/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Failed to delete");
    }
  };

  const clearDay = async (day: number) => {
    if (!confirm(`Clear all entries for ${DAY_LABELS_FULL[day]}?`)) return;
    const dayEntries = entries.filter((e) => e.dayOfWeek === day);
    try {
      for (const e of dayEntries) {
        await adminApiRequest(`/api/admin/timetable/${e.id}`, { method: "DELETE" });
      }
      await load();
    } catch {
      setError("Failed to clear day");
    }
  };

  if (!hasPermission(role, "academics.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Timetable" description="Create and manage class-wise period timetables" />

      <section className="space-y-4 p-4 md:p-7">
        {error && (
          <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Class</label>
            <input
              className="field w-24"
              placeholder="e.g. 10"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Section</label>
            <input
              className="field w-20"
              placeholder="A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>
          {!selectedYear?.id && (
            <span className="text-xs font-semibold text-amber-600">Select an academic year in Settings.</span>
          )}
        </div>

        {editing && (
          <form onSubmit={submit} className="card border-l-4 border-l-primary p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">
                {editing.entry ? "Edit Entry" : `New Entry — ${DAY_LABELS_FULL[form.dayOfWeek]} Period ${form.periodNumber}`}
              </h3>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {editing.entry && (
                <label className="text-sm font-semibold">Day
                  <select className="field mt-1" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </label>
              )}
              {editing.entry && (
                <label className="text-sm font-semibold">Period #
                  <input className="field mt-1" type="number" min={1} value={form.periodNumber}
                    onChange={(e) => setForm({ ...form, periodNumber: Number(e.target.value) })} />
                </label>
              )}
              <label className="text-sm font-semibold">Subject
                <input className="field mt-1" required value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics" />
              </label>
              <label className="text-sm font-semibold flex items-center gap-2 mt-5">
                <input type="checkbox" checked={form.isBreak}
                  onChange={(e) => setForm({ ...form, isBreak: e.target.checked })} />
                Break / Free Period
              </label>
              <label className="text-sm font-semibold">Start Time
                <input className="field mt-1" type="time" required value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">End Time
                <input className="field mt-1" type="time" required value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Teacher
                <input className="field mt-1" value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })} placeholder="Mr. Sharma" />
              </label>
              <label className="text-sm font-semibold">Room
                <input className="field mt-1" value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="101" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : <>{editing.entry ? "Update" : "Add"} <Check size={16} /></>}
              </button>
            </div>
          </form>
        )}

        {!className ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            Enter a class name above to view and manage its timetable.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[80px] border bg-card px-3 py-2 text-left text-xs font-bold text-muted-foreground">
                    Period
                  </th>
                  {DAYS.map((day, i) => (
                    <th key={i} className="min-w-[140px] border bg-card px-3 py-2 text-left text-xs font-bold text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>{day}</span>
                        {entries.some((e) => e.dayOfWeek === i) && hasPermission(role, "academics.delete") && (
                          <button
                            onClick={() => clearDay(i)}
                            className="text-red-400 hover:text-red-600"
                            title="Clear day"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period}>
                    <td className="sticky left-0 z-10 border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
                      {period}
                    </td>
                    {DAYS.map((_, day) => {
                      const entry = entriesByDayPeriod[`${day}-${period}`];
                      return (
                        <td key={day} className="border p-1">
                          {entry ? (
                            <div className={`group relative rounded-lg p-2 text-xs transition hover:shadow-sm ${entry.isBreak ? "bg-muted/40" : "bg-primary/5"}`}>
                              <div className="font-semibold">
                                {entry.isBreak ? (
                                  <span className="text-muted-foreground italic">Break</span>
                                ) : (
                                  <span className="text-foreground">{entry.subject}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {entry.startTime}–{entry.endTime}
                              </div>
                              {entry.teacherName && (
                                <div className="text-[11px] text-muted-foreground">{entry.teacherName}</div>
                              )}
                              {entry.room && (
                                <div className="text-[11px] text-muted-foreground">Room {entry.room}</div>
                              )}
                              {hasPermission(role, "academics.edit") && (
                                <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                                  <button
                                    onClick={() => openEdit(entry)}
                                    className="rounded bg-background p-0.5 text-muted-foreground shadow hover:text-foreground"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => remove(entry.id)}
                                    className="rounded bg-background p-0.5 text-red-400 shadow hover:text-red-600"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            hasPermission(role, "academics.create") && (
                              <button
                                onClick={() => openAdd(day, period)}
                                className="flex h-full w-full items-center justify-center rounded-lg p-3 text-muted-foreground/40 transition hover:bg-secondary/50 hover:text-muted-foreground"
                              >
                                <Plus size={16} />
                              </button>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
