"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS } from "@/lib/studentClasses";
import { hasPermission } from "@sri-narayana/shared";
import { HeartPulse, LogOut, Search, ShieldAlert, Smile, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Kind = "behavior" | "health" | "exits";
type Student = { id: string; fullName: string; admissionNumber?: string; className?: string; section?: string };
type RecordRow = Record<string, unknown> & { id: string; studentName?: string; studentId?: string };

const TABS: { kind: Kind; label: string; icon: typeof Smile; endpoint: string }[] = [
  { kind: "behavior", label: "Behavior", icon: Smile, endpoint: "/api/admin/student-records/behavior" },
  { kind: "health", label: "Health", icon: HeartPulse, endpoint: "/api/admin/student-records/health" },
  { kind: "exits", label: "TC & Exit", icon: LogOut, endpoint: "/api/admin/student-records/exits" }
];

const emptyForm = {
  studentId: "",
  studentName: "",
  admissionNumber: "",
  className: "",
  type: "positive",
  category: "General",
  description: "",
  actionTaken: "",
  date: new Date().toISOString().slice(0, 10),
  bloodGroup: "",
  allergies: "",
  conditions: "",
  lastCheckup: "",
  notes: "",
  reason: "transfer",
  lastDay: new Date().toISOString().slice(0, 10),
  tcNumber: "",
  status: "requested"
};

export default function StudentRecordsPage() {
  const { role } = useAdminSession();
  const popup = usePopup();
  const [kind, setKind] = useState<Kind>("behavior");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canEdit = hasPermission(role, "students.edit");
  const activeTab = useMemo(() => TABS.find((tab) => tab.kind === kind)!, [kind]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApiRequest<{ records: RecordRow[] }>(activeTab.endpoint, undefined, { fresh: true });
      setRecords(data.records ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    setStudentQuery("");
    setStudentResults([]);
  }, [kind]);

  useEffect(() => {
    if (studentQuery.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await adminApiRequest<{ data: Student[] }>(
          `/api/admin/students?q=${encodeURIComponent(studentQuery.trim())}&pageSize=10`
        );
        if (!cancelled) setStudentResults(data.data ?? []);
      } catch {
        if (!cancelled) setStudentResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentQuery]);

  const pickStudent = (student: Student) => {
    setForm((current) => ({
      ...current,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber ?? "",
      className: student.className ?? ""
    }));
    setStudentQuery(`${student.fullName}${student.admissionNumber ? ` (${student.admissionNumber})` : ""}`);
    setStudentResults([]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.studentId) {
      popup.error("Select a student", "Search and pick a student first.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        studentId: form.studentId,
        studentName: form.studentName,
        admissionNumber: form.admissionNumber,
        className: form.className
      };
      if (kind === "behavior") {
        Object.assign(payload, {
          type: form.type,
          category: form.category,
          description: form.description,
          actionTaken: form.actionTaken,
          date: form.date
        });
      } else if (kind === "health") {
        Object.assign(payload, {
          bloodGroup: form.bloodGroup,
          allergies: form.allergies,
          conditions: form.conditions,
          lastCheckup: form.lastCheckup,
          notes: form.notes
        });
      } else {
        Object.assign(payload, {
          reason: form.reason,
          lastDay: form.lastDay,
          tcNumber: form.tcNumber,
          status: form.status,
          notes: form.notes
        });
      }
      await adminApiRequest(activeTab.endpoint, { method: "POST", body: JSON.stringify(payload) });
      popup.success("Record saved");
      setForm((current) => ({ ...current, studentId: "", studentName: "", admissionNumber: "", description: "", actionTaken: "", notes: "" }));
      setStudentQuery("");
      await load();
    } catch (err) {
      popup.error("Could not save", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record: RecordRow) => {
    const confirmed = await popup.confirm("Delete record?", record.studentName || "This cannot be undone.", {
      okLabel: "Delete",
      danger: true
    });
    if (!confirmed) return;
    try {
      await adminApiRequest(`${activeTab.endpoint}/${record.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      popup.error("Could not delete", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  const renderCell = (record: RecordRow) => {
    if (kind === "behavior") {
      return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.type === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
          {String(record.type)}
        </span>
      );
    }
    if (kind === "health") return <span className="font-semibold">{String(record.bloodGroup || "—")}</span>;
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize dark:bg-slate-800">
        {String(record.status || "")}
      </span>
    );
  };

  return (
    <>
      <PageHeader title="Student Records" description="Behavior notes, health profiles and transfer certificates in one place." />

      <section className="space-y-5 p-4 md:p-7">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.kind === kind;
            return (
              <button
                key={tab.kind}
                type="button"
                onClick={() => setKind(tab.kind)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${active ? "bg-primary text-primary-foreground" : "card text-muted-foreground hover:text-foreground"}`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        {canEdit && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-semibold">Student</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  className="field pl-9"
                  value={studentQuery}
                  onChange={(event) => {
                    setStudentQuery(event.target.value);
                    if (!event.target.value) setForm((current) => ({ ...current, studentId: "", studentName: "" }));
                  }}
                  placeholder="Search by name or admission number…"
                />
                {studentResults.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
                    {studentResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                        onClick={() => pickStudent(student)}
                      >
                        <span className="font-semibold">{student.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {student.admissionNumber} · {CLASS_LABELS[student.className ?? ""] ?? student.className} {student.section ?? ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="mt-1 text-xs text-muted-foreground">Searching…</p>}
              </div>
            </div>

            {kind === "behavior" && (
              <>
                <label className="text-sm font-semibold">
                  Type
                  <select className="field mt-1" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative / Incident</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Category
                  <input className="field mt-1" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </label>
                <label className="text-sm font-semibold">
                  Date
                  <input className="field mt-1" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                  Description
                  <textarea className="field mt-1 min-h-[70px]" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                  Action taken
                  <input className="field mt-1" value={form.actionTaken} onChange={(event) => setForm({ ...form, actionTaken: event.target.value })} />
                </label>
              </>
            )}

            {kind === "health" && (
              <>
                <label className="text-sm font-semibold">
                  Blood group
                  <input className="field mt-1" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })} placeholder="O+" />
                </label>
                <label className="text-sm font-semibold">
                  Last check-up
                  <input className="field mt-1" type="date" value={form.lastCheckup} onChange={(event) => setForm({ ...form, lastCheckup: event.target.value })} />
                </label>
                <label className="text-sm font-semibold">
                  Allergies
                  <input className="field mt-1" value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                  Medical conditions
                  <input className="field mt-1" value={form.conditions} onChange={(event) => setForm({ ...form, conditions: event.target.value })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                  Notes
                  <textarea className="field mt-1 min-h-[60px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </label>
              </>
            )}

            {kind === "exits" && (
              <>
                <label className="text-sm font-semibold">
                  Reason
                  <select className="field mt-1" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>
                    <option value="transfer">Transfer</option>
                    <option value="graduation">Graduation</option>
                    <option value="relocation">Relocation</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Last working day
                  <input className="field mt-1" type="date" value={form.lastDay} onChange={(event) => setForm({ ...form, lastDay: event.target.value })} />
                </label>
                <label className="text-sm font-semibold">
                  Status
                  <select className="field mt-1" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="requested">Requested</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  TC number
                  <input className="field mt-1" value={form.tcNumber} onChange={(event) => setForm({ ...form, tcNumber: event.target.value })} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Notes
                  <input className="field mt-1" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </label>
              </>
            )}

            <div className="flex justify-end sm:col-span-2 lg:col-span-3">
              <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save record"}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <ShieldAlert size={28} />
            No {activeTab.label.toLowerCase()} records yet.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Details</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{String(record.studentName || "—")}</p>
                      <p className="text-xs text-muted-foreground">{String(record.admissionNumber || "")}</p>
                    </td>
                    <td className="px-4 py-3">
                      {CLASS_LABELS[String(record.className || "")] ?? String(record.className || "—")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {renderCell(record)}
                        <span className="text-muted-foreground">
                          {kind === "behavior" && String(record.description ?? "")}
                          {kind === "health" && `Allergies: ${String(record.allergies || "None")}`}
                          {kind === "exits" && `${String(record.reason ?? "")} · ${String(record.lastDay ?? "")}`}
                        </span>
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          onClick={() => void remove(record)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
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
