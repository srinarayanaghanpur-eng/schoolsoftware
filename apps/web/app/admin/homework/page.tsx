"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { Plus, X, Search, CalendarDays, Clock, BookOpen, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Homework = {
  id: string;
  title: string;
  subject: string;
  className: string;
  section?: string;
  assignedDate: string;
  dueDate: string;
  status: string;
};

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function HomeworkPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    subject: "",
    className: "",
    section: "",
    assignedDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    academicYearId: selectedYear?.id || "",
  });

  const load = async () => {
    if (!selectedYear?.id) { setHomework([]); setLoading(false); return; }
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await adminApiRequest<{ homework: Homework[] }>(`/api/admin/homework?${params}`);
      setHomework(data.homework || []);
    } catch { setHomework([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [selectedYear?.id, statusFilter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await adminApiRequest("/api/admin/homework", {
        method: "POST",
        body: JSON.stringify({ ...form, academicYearId: selectedYear?.id || "" }),
      });
      setShow(false);
      setForm({ ...form, title: "", description: "", subject: "", className: "", dueDate: "" });
      await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to create"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this homework entry?")) return;
    try { await adminApiRequest(`/api/admin/homework/${id}`, { method: "DELETE" }); await load(); }
    catch { setError("Failed to delete"); }
  };

  const filtered = homework.filter((h) =>
    !search || h.title.toLowerCase().includes(search.toLowerCase()) || h.subject.toLowerCase().includes(search.toLowerCase()) || h.className.includes(search)
  );

  if (!hasPermission(role, "exams.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Homework" description="Assign and manage homework across classes" />

      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && (
          <div className="card p-5 text-sm font-semibold text-amber-600">Select an academic year to load homework.</div>
        )}

        {error && (
          <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="field !pl-9" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {hasPermission(role, "exams.create") && (
            <button className="btn-primary" onClick={() => setShow((v) => !v)}>
              {show ? <X size={16} /> : <Plus size={16} />} Assign Homework
            </button>
          )}
        </div>

        {show && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">Title
              <input className="field mt-1" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Subject
              <input className="field mt-1" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics" />
            </label>
            <label className="text-sm font-semibold">Class
              <input className="field mt-1" required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="10" />
            </label>
            <label className="text-sm font-semibold">Section
              <input className="field mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
            </label>
            <label className="text-sm font-semibold">Assigned Date
              <input className="field mt-1" type="date" required value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Due Date
              <input className="field mt-1" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold">Description
                <textarea className="field mt-1" rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn-primary">Assign</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted-foreground">
              {homework.length === 0 ? "No homework assigned yet." : "No homework matches your search."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((hw) => (
                <div key={hw.id} className="card p-4 transition hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-foreground">{hw.title}</h3>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen size={12} /> {hw.subject} · Class {hw.className}{hw.section ? ` - ${hw.section}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[hw.status] || ""}`}>
                      {formatLabel(hw.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays size={12} /> {hw.assignedDate}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> Due: {hw.dueDate}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/admin/homework/${hw.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/20"
                    >
                      <Eye size={14} /> View
                    </Link>
                    {hasPermission(role, "exams.delete") && (
                      <button
                        onClick={() => remove(hw.id)}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
