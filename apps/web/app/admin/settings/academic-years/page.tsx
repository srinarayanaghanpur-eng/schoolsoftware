"use client";

import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { academicYearCreateSchema, hasPermission, type AcademicYear } from "@sri-narayana/shared";
import { AlertCircle, CalendarRange, CheckCircle2, Edit3, Plus, Power, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type YearForm = {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const blankForm: YearForm = {
  name: "",
  startDate: "",
  endDate: "",
  isActive: false
};

function formatDate(value: string) {
  if (!value) return "--";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formFromYear(year: AcademicYear): YearForm {
  return {
    name: year.name,
    startDate: year.startDate,
    endDate: year.endDate,
    isActive: year.isActive
  };
}

function AccessNotice() {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <AlertCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Academic year management is restricted to the super admin.</p>
        </div>
      </div>
    </section>
  );
}

export default function AcademicYearsPage() {
  const { role } = useAdminSession();
  const { years, loading, error, accessDenied, refreshYears, activateYear } = useAcademicYears();
  const [showForm, setShowForm] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState<YearForm>(blankForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canView = Boolean(role && hasPermission(role, "academic_years.view"));
  // Management is super_admin only (per-login year model: the year is chosen at
  // login, and only the super admin maintains the list of years).
  const canWrite = Boolean(canView && role === "super_admin");
  const canDelete = role === "super_admin";
  const activeYear = useMemo(() => years.find((year) => year.isActive) ?? null, [years]);

  const openCreate = () => {
    setEditingYear(null);
    setForm(blankForm);
    setFormError(null);
    setActionError(null);
    setMessage(null);
    setShowForm(true);
  };

  const openEdit = (year: AcademicYear) => {
    setEditingYear(year);
    setForm(formFromYear(year));
    setFormError(null);
    setActionError(null);
    setMessage(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingYear(null);
    setForm(blankForm);
    setFormError(null);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setActionError(null);
    setMessage(null);

    const parsed = academicYearCreateSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the academic year details.");
      return;
    }
    if (parsed.data.endDate < parsed.data.startDate) {
      setFormError("End date must be after start date.");
      return;
    }

    setPendingId(editingYear?.id ?? "new");
    try {
      if (editingYear?.id) {
        await adminApiRequest<{ ok: true }>(`/api/admin/academic-years/${editingYear.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: parsed.data.name,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate
          })
        });
        if (parsed.data.isActive && !editingYear.isActive) {
          await activateYear(editingYear.id);
        } else {
          await refreshYears({ force: true });
        }
        setMessage("Academic year updated.");
      } else {
        await adminApiRequest<{ ok: true; id: string }>("/api/admin/academic-years", {
          method: "POST",
          body: JSON.stringify(parsed.data)
        });
        await refreshYears({ force: true });
        setMessage("Academic year added.");
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save academic year.");
    } finally {
      setPendingId(null);
    }
  };

  const setActive = async (year: AcademicYear) => {
    if (!year.id || year.isActive) return;
    setPendingId(year.id);
    setActionError(null);
    setMessage(null);
    try {
      await activateYear(year.id);
      setMessage(`${year.name} is now active.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to activate academic year.");
    } finally {
      setPendingId(null);
    }
  };

  const deleteYear = async (year: AcademicYear) => {
    if (!year.id) return;
    if (!window.confirm(`Delete academic year ${year.name}?`)) return;

    setPendingId(year.id);
    setActionError(null);
    setMessage(null);
    try {
      await adminApiRequest<{ ok: true }>(`/api/admin/academic-years/${year.id}`, { method: "DELETE" });
      await refreshYears({ force: true });
      setMessage("Academic year deleted.");
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Unable to delete academic year.";
      setActionError(message);
    } finally {
      setPendingId(null);
    }
  };

  if (accessDenied || !canView) {
    return (
      <>
        <PageHeader title="Academic Years" description="Manage school year windows and the default (active) year." />
        <AccessNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Academic Years"
        description={activeYear ? `${activeYear.name} is the default year offered at login.` : years.length ? "No academic year is active." : "Create the first academic year to begin."}
        action={
          canWrite ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add Academic Year
            </button>
          ) : null
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {(error || actionError) && (
          <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
            {actionError ?? error}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10122d]/45 p-4 backdrop-blur-sm">
            <form onSubmit={submitForm} className="w-full max-w-2xl rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_24px_70px_rgba(16,18,45,0.22)] md:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1f2136]">{editingYear ? "Edit academic year" : "Add academic year"}</h2>
                  <p className="mt-1 text-sm font-medium text-[#7d86a8]">Use dates in the school operating calendar.</p>
                </div>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={closeForm} title="Close">
                  <X size={18} />
                </button>
              </div>

              {formError && <div className="mb-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{formError}</div>}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm font-semibold text-[#303247]">
                  <span>Name</span>
                  <input className="field" placeholder="2026-27" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </label>
                <label className="space-y-1 text-sm font-semibold text-[#303247]">
                  <span>Start date</span>
                  <DatePicker value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
                </label>
                <label className="space-y-1 text-sm font-semibold text-[#303247]">
                  <span>End date</span>
                  <DatePicker value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-[#303247]">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-[#dfe3f1] accent-[#3033a1]"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Set as active (default at login)
              </label>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button className="btn-primary" disabled={pendingId === (editingYear?.id ?? "new")}>
                  {pendingId === (editingYear?.id ?? "new") ? "Saving..." : editingYear ? "Save changes" : "Create year"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading academic years...</div>
          ) : years.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef0ff] text-[#3033a1]">
                <CalendarRange size={26} />
              </span>
              <h2 className="mt-4 text-lg font-extrabold text-[#1f2136]">No academic years yet</h2>
              {canWrite && (
                <button type="button" className="btn-primary mt-4" onClick={openCreate}>
                  <Plus size={16} /> Add Academic Year
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Name</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Date Range</th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((year) => (
                    <tr key={year.id ?? year.name} className="border-b border-[#edf0f7] last:border-b-0">
                      <td className="px-5 py-4 font-extrabold text-[#303247]">{year.name}</td>
                      <td className="px-5 py-4 font-medium text-[#7d86a8]">{formatDate(year.startDate)} to {formatDate(year.endDate)}</td>
                      <td className="px-5 py-4">
                        {year.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f8ef] px-3 py-1 text-xs font-extrabold text-[#0f8d52]">
                            <CheckCircle2 size={14} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#eef0f7] px-3 py-1 text-xs font-extrabold text-[#7d86a8]">Inactive</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {canWrite && !year.isActive && (
                            <button type="button" className="btn-secondary" onClick={() => void setActive(year)} disabled={pendingId === year.id}>
                              <Power size={15} /> Set Active
                            </button>
                          )}
                          {canWrite && (
                            <button type="button" className="btn-secondary" onClick={() => openEdit(year)} disabled={pendingId === year.id}>
                              <Edit3 size={15} /> Edit
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" className="btn-secondary" onClick={() => void deleteYear(year)} disabled={year.isActive || pendingId === year.id}>
                              <Trash2 size={15} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
