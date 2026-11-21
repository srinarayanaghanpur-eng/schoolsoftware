"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Printer, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type StudentOption = {
  id: string;
  studentName?: string;
  admissionNumber?: string;
  class?: string;
  section?: string;
};

type Challan = {
  id: string;
  challanNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  total: number;
  dueDate: string;
  status: string;
  items: { label: string; amount: number }[];
};

const statusStyles: Record<string, string> = {
  issued: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
};

function isoDate(offsetDays = 7) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function FeeChallansPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const popup = usePopup();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentOption[]>([]);
  const [student, setStudent] = useState<StudentOption | null>(null);
  const [items, setItems] = useState<{ label: string; amount: string }[]>([{ label: "Outstanding fees", amount: "" }]);
  const [dueDate, setDueDate] = useState(isoDate());
  const [notes, setNotes] = useState("");

  const canCreate = hasPermission(role, "fees.create");
  const canEdit = hasPermission(role, "fees.edit");
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const load = async () => {
    try {
      const data = await adminApiRequest<{ challans: Challan[] }>("/api/admin/fee-challans");
      setChallans(data.challans ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load challans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const searchStudents = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q: query.trim(), pageSize: "10" });
      if (selectedYear?.id) params.set("academicYearId", selectedYear.id);
      const data = await adminApiRequest<{ data: StudentOption[] }>(`/api/admin/students?${params}`);
      setResults(data.data ?? []);
    } catch {
      setResults([]);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!student) {
      popup.error("Select a student", "Search and pick a student before creating a challan.");
      return;
    }
    const cleanItems = items
      .map((item) => ({ label: item.label.trim(), amount: Number(item.amount) }))
      .filter((item) => item.label && item.amount > 0);
    if (cleanItems.length === 0) {
      popup.error("Add at least one fee item");
      return;
    }
    setSaving(true);
    try {
      const result = await adminApiRequest<{ challanNumber: string }>("/api/admin/fee-challans", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.studentName ?? "",
          admissionNumber: student.admissionNumber ?? "",
          className: student.class ?? "",
          section: student.section ?? "",
          academicYearId: selectedYear?.id ?? "",
          dueDate,
          notes,
          items: cleanItems
        })
      });
      popup.success("Challan created", `${result.challanNumber} · ₹${total.toLocaleString("en-IN")}`);
      setShowForm(false);
      setStudent(null);
      setQuery("");
      setResults([]);
      setItems([{ label: "Outstanding fees", amount: "" }]);
      setNotes("");
      await load();
    } catch (err) {
      popup.error("Could not create challan", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (challan: Challan, status: "paid" | "cancelled") => {
    try {
      await adminApiRequest(`/api/admin/fee-challans/${challan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      popup.error("Could not update", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  const remove = async (challan: Challan) => {
    const confirmed = await popup.confirm("Delete challan?", `${challan.challanNumber} will be removed.`, {
      okLabel: "Delete",
      danger: true
    });
    if (!confirmed) return;
    try {
      await adminApiRequest(`/api/admin/fee-challans/${challan.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      popup.error("Could not delete", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  return (
    <>
      <PageHeader title="Fee Challans" description="Issue itemised fee challans that parents can pay offline at a bank or counter." />

      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{challans.length} challan(s)</p>
          {canCreate && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((value) => !value)}>
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Close" : "New challan"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <div>
              <label className="text-sm font-semibold">Student</label>
              {student ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <span className="text-sm font-bold">
                    {student.studentName} · {student.admissionNumber || student.id}
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      Class {student.class ?? "—"}{student.section ? `-${student.section}` : ""}
                    </span>
                  </span>
                  <button type="button" className="text-xs font-bold text-primary" onClick={() => setStudent(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="field !pl-9"
                        placeholder="Search by name or admission number"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void searchStudents();
                          }
                        }}
                      />
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => void searchStudents()}>Search</button>
                  </div>
                  {results.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                      {results.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setStudent(option);
                            setResults([]);
                          }}
                        >
                          <span className="font-semibold">{option.studentName}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.admissionNumber} · {option.class ?? ""}{option.section ?? ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Fee items</label>
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="field flex-1"
                    placeholder="Fee head (e.g. Term 2 tuition)"
                    value={item.label}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...next[index], label: event.target.value };
                      setItems(next);
                    }}
                  />
                  <input
                    className="field w-36"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...next[index], amount: event.target.value };
                      setItems(next);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-red-100 px-3 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    onClick={() => setItems(items.length === 1 ? items : items.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-bold text-primary"
                onClick={() => setItems([...items, { label: "", amount: "" }])}
              >
                + Add item
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold">
                Due date
                <input className="field mt-1" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Notes
                <input className="field mt-1" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-base font-extrabold">Total: ₹{total.toLocaleString("en-IN")}</p>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create challan"}</button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : challans.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">No challans issued yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Challan</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {challans.map((challan) => (
                  <tr key={challan.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold">{challan.challanNumber}</td>
                    <td className="px-4 py-3">
                      {challan.studentName}
                      <span className="ml-1 text-xs text-muted-foreground">{challan.admissionNumber}</span>
                    </td>
                    <td className="px-4 py-3">{challan.className}{challan.section ? `-${challan.section}` : ""}</td>
                    <td className="px-4 py-3 font-semibold">₹{(Number(challan.total) || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">{challan.dueDate || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[challan.status] ?? ""}`}>
                        {challan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-bold"
                          onClick={() => window.print()}
                        >
                          <Printer size={14} /> Print
                        </button>
                        {canEdit && challan.status === "issued" && (
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            onClick={() => void setStatus(challan, "paid")}
                          >
                            Mark paid
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            onClick={() => void remove(challan)}
                          >
                            <Trash2 size={14} />
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
      </section>
    </>
  );
}
