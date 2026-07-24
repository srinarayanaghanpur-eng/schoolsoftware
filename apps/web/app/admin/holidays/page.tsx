"use client";

import { DatePicker } from "@/components/DatePicker";
import { DeclareHolidayModal } from "@/components/DeclareHolidayModal";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { auth } from "@sri-narayana/shared/firebase/client";
import { isHolidayActive, hasPermission, type Holiday } from "@sri-narayana/shared";
import { Ban, CalendarOff, ChevronDown, ChevronUp, Edit2, Plus, Save, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const MONTHS = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

const initialYear = () => new Date().getFullYear().toString();
const initialMonth = () => String(new Date().getMonth() + 1).padStart(2, "0");

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function HolidaysPage() {
  const { role } = useAdminSession();
  const canManage = Boolean(role && hasPermission(role, "settings.edit"));
  const isSuperAdmin = role === "super_admin";

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState(initialYear);
  const [filterMonth, setFilterMonth] = useState(initialMonth);

  // New holiday form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createReason, setCreateReason] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editReason, setEditReason] = useState("");

  // Show more
  const [showAll, setShowAll] = useState(false);
  const DISPLAY_LIMIT = 5;

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
      const params = new URLSearchParams({ year: filterYear, month: filterMonth });
      const result = await apiRequest<{ holidays: Holiday[] }>(`/api/admin/holidays/management?${params}`);
      setHolidays(result.holidays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterMonth]);

  const createHoliday = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>("/api/admin/holidays/management", {
        method: "POST",
        body: JSON.stringify({ date: createDate, reason: createReason })
      });
      setMessage(result.message ?? "Holiday declared.");
      setCreateDate("");
      setCreateReason("");
      setShowCreateForm(false);
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create holiday");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (holiday: Holiday) => {
    setEditingId(holiday.id ?? null);
    setEditDate(holiday.date.slice(0, 10));
    setEditReason(holiday.reason ?? "");
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>("/api/admin/holidays/management", {
        method: "PATCH",
        body: JSON.stringify({ holidayId: editingId, date: editDate, reason: editReason })
      });
      setMessage(result.message ?? "Holiday updated.");
      setEditingId(null);
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update holiday");
    } finally {
      setSaving(false);
    }
  };

  const cancelHoliday = async (holiday: Holiday) => {
    if (!holiday.id) return;
    if (!window.confirm(`Cancel the declared holiday on ${formatDate(holiday.date)}? Attendance will be required again.`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>(`/api/admin/holidays/management?holidayId=${holiday.id}`, {
        method: "DELETE"
      });
      setMessage(result.message ?? "Holiday cancelled.");
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel holiday");
    } finally {
      setSaving(false);
    }
  };

  // Filter holidays to only active ones for display by default
  const activeHolidays = holidays.filter((h) => isHolidayActive(h));
  const cancelledHolidays = holidays.filter((h) => !isHolidayActive(h));
  const displayHolidays = showAll ? holidays : activeHolidays.slice(0, DISPLAY_LIMIT);
  const totalInMonth = activeHolidays.length;

  return (
    <>
      <PageHeader
        title="Management Declared Holidays"
        description="View, create, and manage holidays declared by management. These dates are excluded from attendance and payroll."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && <DeclareHolidayModal onDeclared={loadHolidays} />}
            {canManage && (
              <button className="btn-primary" onClick={() => { setShowCreateForm((v) => !v); setEditingId(null); }}>
                <Plus size={16} /> Add Holiday
              </button>
            )}
          </div>
        }
      />

      <section className="space-y-5 p-4 md:p-6 lg:p-8">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {/* Month/Year Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <select className="field w-auto" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <select className="field w-auto" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={loadHolidays} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && canManage && (
          <form onSubmit={createHoliday} className="card grid gap-4 p-5 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-[#303247]">Holiday Date *</label>
              <div className="mt-1">
                <DatePicker value={createDate} onChange={(e) => setCreateDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#303247]">Reason *</label>
              <input className="field mt-1 w-full" value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder="e.g. Heavy Rain" required />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setShowCreateForm(false); setCreateDate(""); setCreateReason(""); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Management Declared Holidays Card */}
        <div className="card overflow-hidden">
          <div className="border-b border-[#edf0f7] bg-[#fafbff] px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarOff size={18} className="text-[#b97e10]" />
                <h3 className="text-base font-extrabold text-[#1f2136]">Management Declared Holidays</h3>
              </div>
              <span className="rounded-full bg-[#fff4df] px-3 py-1 text-xs font-extrabold text-[#b97e10]">
                {totalInMonth} this month
              </span>
            </div>
          </div>

          {loading && holidays.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">Loading holidays...</div>
          ) : displayHolidays.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">No management holidays for this month.</div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Reason</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Declared By</th>
                      <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                      {canManage && <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayHolidays.map((holiday) => {
                      const active = isHolidayActive(holiday);
                      const isEditing = editingId === holiday.id;
                      return (
                        <tr key={holiday.id ?? holiday.date} className={`border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff] ${!active ? "opacity-60" : ""}`}>
                          {isEditing ? (
                            <>
                              <td className="px-5 py-3" colSpan={canManage ? 5 : 4}>
                                <form onSubmit={saveEdit} className="flex flex-wrap items-end gap-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-[#303247]">Date</label>
                                    <DatePicker value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                                  </div>
                                  <div className="min-w-[200px]">
                                    <label className="block text-xs font-semibold text-[#303247]">Reason</label>
                                    <input className="field mt-1 w-full" value={editReason} onChange={(e) => setEditReason(e.target.value)} required />
                                  </div>
                                  <div className="flex gap-2">
                                    <button className="btn-primary text-sm" disabled={saving}>
                                      <Save size={14} /> Save
                                    </button>
                                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditingId(null)}>
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-5 py-4 text-sm font-bold text-[#303247]">{formatDate(holiday.date)}</td>
                              <td className="px-5 py-4 text-sm font-medium text-[#5f6888]">{holiday.reason || holiday.title}</td>
                              <td className="px-5 py-4 text-sm font-medium text-[#7d86a8]">{holiday.declaredByName || "—"}</td>
                              <td className="px-5 py-4 text-center">
                                {active ? (
                                  <span className="inline-block rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#0f8d52]">Active</span>
                                ) : (
                                  <span className="inline-block rounded-full bg-[#ffebed] px-2.5 py-1 text-xs font-bold text-[#c83f4d]">Cancelled</span>
                                )}
                              </td>
                              {canManage && (
                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {active && (
                                      <button onClick={() => startEdit(holiday)} className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]" title="Edit">
                                        <Edit2 size={14} />
                                      </button>
                                    )}
                                    {active && (
                                      <button onClick={() => cancelHoliday(holiday)} className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#c83f4d]" title="Delete/Cancel">
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card list */}
              <div className="divide-y divide-[#edf0f7] md:hidden">
                {displayHolidays.map((holiday) => {
                  const active = isHolidayActive(holiday);
                  const isEditing = editingId === holiday.id;
                  return (
                    <div key={holiday.id ?? holiday.date} className={`p-4 ${!active ? "opacity-60" : ""}`}>
                      {isEditing ? (
                        <form onSubmit={saveEdit} className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#303247]">Date</label>
                            <DatePicker value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#303247]">Reason</label>
                            <input className="field mt-1 w-full" value={editReason} onChange={(e) => setEditReason(e.target.value)} required />
                          </div>
                          <div className="flex gap-2">
                            <button className="btn-primary text-sm" disabled={saving}><Save size={14} /> Save</button>
                            <button type="button" className="btn-secondary text-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#303247]">{formatDate(holiday.date)}</p>
                              <p className="mt-0.5 text-sm font-medium text-[#5f6888]">{holiday.reason || holiday.title}</p>
                              {holiday.declaredByName && (
                                <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">Declared by {holiday.declaredByName}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {active ? (
                                <span className="rounded-full bg-[#e6f8ef] px-2 py-0.5 text-xs font-bold text-[#0f8d52]">Active</span>
                              ) : (
                                <span className="rounded-full bg-[#ffebed] px-2 py-0.5 text-xs font-bold text-[#c83f4d]">Cancelled</span>
                              )}
                              {canManage && active && (
                                <>
                                  <button onClick={() => startEdit(holiday)} className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => cancelHoliday(holiday)} className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#c83f4d]">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Show more / Show less */}
          {holidays.length > DISPLAY_LIMIT && (
            <div className="border-t border-[#edf0f7] px-5 py-3 text-center">
              <button
                className="inline-flex items-center gap-1 text-sm font-bold text-[#3033a1] hover:text-[#20226f]"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? (
                  <>Show less <ChevronUp size={16} /></>
                ) : (
                  <>Show all ({holidays.length} holidays) <ChevronDown size={16} /></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Cancelled summaries */}
        {cancelledHolidays.length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#7d86a8] hover:text-[#303247]">
              Cancelled holidays ({cancelledHolidays.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {cancelledHolidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm text-[#9aa1bd]">
                  <span>
                    <span className="line-through">{formatDate(h.date)}</span>
                    <span className="ml-2">— {h.reason || h.title}</span>
                  </span>
                  {canManage && (
                    <button
                      className="text-xs font-bold text-[#3033a1] hover:underline"
                      onClick={async () => {
                        try {
                          await apiRequest("/api/admin/holidays/management", {
                            method: "POST",
                            body: JSON.stringify({ date: h.date.slice(0, 10), reason: h.reason || h.title })
                          });
                          setMessage("Holiday reactivated.");
                          await loadHolidays();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Unable to reactivate");
                        }
                      }}
                    >
                      Reactivate
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
