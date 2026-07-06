"use client";

import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Student = { id: string; studentName: string; class?: string; section?: string };
type Installment = { number: number; amount: number; dueDate: string; status: string; paidDate?: string; paymentId?: string };
type InstallmentPlan = { id: string; studentId: string; studentName?: string; totalAmount: number; paidAmount: number; installments: Installment[]; academicYearId: string; createdBy: string; createdAt: string };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

const statusBadge: Record<string, string> = {
  pending: "bg-[#fff4df] text-[#b8791a]",
  paid: "bg-[#e6f8ef] text-[#14a762]",
  overdue: "bg-[#ffebed] text-[#ed515d]",
  cancelled: "bg-stone-100 text-stone-500"
};

export default function InstallmentsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const [form, setForm] = useState({ studentId: "", totalAmount: "", numInstallments: "2", firstDueDate: "" });

  async function load() {
    if (!selectedYear?.id) {
      setPlans([]);
      setStudents([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" });
      const [pRes, sRes] = await Promise.all([
        adminApiRequest<{ plans: InstallmentPlan[] }>(`/api/admin/finance/installments?${params}`),
        adminApiRequest<{ success?: boolean; data?: Student[] }>(`/api/admin/students?${params}`)
      ]);
      setPlans(pRes.plans);
      setStudents(sRes.data ?? []);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedYear?.id]);

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    setSubmitting(true);
    setError("");
    try {
      const total = Number(form.totalAmount);
      const num = Number(form.numInstallments);
      const perInstallment = Math.round(total / num);
      const remainder = total - perInstallment * num;

      const installments: Installment[] = Array.from({ length: num }, (_, i) => {
        const dueDate = new Date(form.firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        const amount = i === num - 1 ? perInstallment + remainder : perInstallment;
        return { number: i + 1, amount, dueDate: dueDate.toISOString().slice(0, 10), status: "pending" };
      });

      await adminApiRequest("/api/admin/finance/installments", {
        method: "POST",
        body: JSON.stringify({
          studentId: form.studentId,
          totalAmount: total,
          installments,
          academicYearId: selectedYear.id
        })
      });

      setForm({ studentId: "", totalAmount: "", numInstallments: "2", firstDueDate: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  }

  async function markPaid(planId: string, installmentNumber: number) {
    setPayingId(`${planId}-${installmentNumber}`);
    setError("");
    try {
      await adminApiRequest(`/api/admin/finance/installments/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ installmentNumber })
      });
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to mark as paid");
    } finally {
      setPayingId(null);
    }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const canCreate = hasPermission(role, "fees.create");
  const selectedStudent = students.find((s) => s.id === form.studentId);
  const perInstallment = form.totalAmount && form.numInstallments ? Math.round(Number(form.totalAmount) / Number(form.numInstallments)) : 0;

  return (
    <>
      <PageHeader
        title="Installment Plans"
        description="Create and manage fee installment plans for students."
        action={canCreate && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Cancel" : "Create Plan"}
          </button>
        )}
      />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load installment plans.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {showForm && (
          <form onSubmit={createPlan} className="card space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="field" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.studentName} {s.class ? `(${s.class}${s.section ? "-" + s.section : ""})` : ""}</option>)}
              </select>
              <input className="field" type="number" min="1" step="0.01" placeholder="Total amount ₹" required value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
              <input className="field" type="number" min="1" max="36" placeholder="No. of installments" required value={form.numInstallments} onChange={(e) => setForm({ ...form, numInstallments: e.target.value })} />
              <DatePicker required value={form.firstDueDate} onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })} />
            </div>
            {selectedStudent && perInstallment > 0 && (
              <p className="text-sm text-[#303247]">
                <span className="font-semibold">{selectedStudent.studentName}</span> — {form.numInstallments} installments of <span className="font-bold text-[#3436a2]">{inr(perInstallment)}</span> each
                {Number(form.totalAmount) % Number(form.numInstallments) !== 0 && <span className="text-stone-500"> (last installment adjusted)</span>}
              </p>
            )}
            <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Creating…" : "Create installment plan"}</button>
          </form>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="card p-8 text-center text-stone-400">Loading…</div>
          ) : plans.length === 0 ? (
            <div className="card p-8 text-center text-stone-400">No installment plans yet.</div>
          ) : (
            plans.map((plan) => {
              const pct = plan.totalAmount > 0 ? Math.round((plan.paidAmount / plan.totalAmount) * 100) : 0;
              const isOpen = open === plan.id;
              return (
                <div key={plan.id} className="card overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : plan.id)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-stone-50">
                    <span className="flex items-center gap-2 font-bold text-[#1f2136]">
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      {plan.studentName || "Unknown"}
                      <span className="ml-1 text-xs font-medium text-stone-400">{plan.installments.length} installments</span>
                    </span>
                    <span className="font-bold text-[#3436a2]">{inr(plan.paidAmount)} / {inr(plan.totalAmount)}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-stone-100 px-5 py-3">
                      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-[#14a762] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="divide-y divide-stone-100">
                        {plan.installments.map((inst) => (
                          <div key={inst.number} className="flex items-center justify-between py-2.5 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef0ff] text-xs font-bold text-[#3033a1]">{inst.number}</span>
                              <div>
                                <p className="font-semibold text-[#303247]">{inr(inst.amount)}</p>
                                <p className="text-xs text-stone-400">Due {inst.dueDate}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {inst.paidDate && <span className="text-xs text-stone-400">{inst.paidDate}</span>}
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadge[inst.status] || "bg-stone-100 text-stone-500"}`}>{inst.status}</span>
                              {inst.status === "pending" && canCreate && (
                                <button
                                  onClick={() => markPaid(plan.id, inst.number)}
                                  disabled={payingId === `${plan.id}-${inst.number}`}
                                  className="rounded-lg bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff] disabled:opacity-50"
                                >
                                  {payingId === `${plan.id}-${inst.number}` ? "…" : "Mark Paid"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
