"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import {
  FEE_FINE_FREQUENCIES,
  FEE_FINE_FREQUENCY_LABELS,
  FEE_FINE_SCOPES,
  FEE_FINE_SCOPE_LABELS,
  FEE_FINE_TYPES,
  FEE_FINE_TYPE_LABELS,
  type FeeFineRule
} from "@/lib/feeFineRules";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type FormState = {
  name: string;
  scope: (typeof FEE_FINE_SCOPES)[number];
  graceDays: string;
  fineType: (typeof FEE_FINE_TYPES)[number];
  amount: string;
  frequency: (typeof FEE_FINE_FREQUENCIES)[number];
  maxFine: string;
  academicYearId: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  scope: "late_payment",
  graceDays: "0",
  fineType: "flat",
  amount: "",
  frequency: "one_time",
  maxFine: "0",
  academicYearId: "",
  active: true
};

export default function FeeFineRulesPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();
  const popup = usePopup();
  const [rules, setRules] = useState<FeeFineRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const canCreate = hasPermission(role, "fees.create");
  const canEdit = hasPermission(role, "fees.edit");

  const load = async () => {
    try {
      const data = await adminApiRequest<{ rules: FeeFineRule[] }>("/api/admin/fee-fine-rules");
      setRules(data.rules ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load fine rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await adminApiRequest("/api/admin/fee-fine-rules", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          scope: form.scope,
          graceDays: Number(form.graceDays || 0),
          fineType: form.fineType,
          amount: Number(form.amount || 0),
          frequency: form.frequency,
          maxFine: Number(form.maxFine || 0),
          academicYearId: form.academicYearId || selectedYear?.id || "",
          active: form.active
        })
      });
      popup.success("Fine rule saved", "New penalty rule is now available for fee collection.");
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      popup.error("Could not save rule", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: FeeFineRule) => {
    try {
      await adminApiRequest(`/api/admin/fee-fine-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active })
      });
      await load();
    } catch (err) {
      popup.error("Could not update rule", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  const remove = async (rule: FeeFineRule) => {
    const confirmed = await popup.confirm(
      "Delete fine rule?",
      `“${rule.name}” will stop applying to new fee collections.`,
      { okLabel: "Delete", danger: true }
    );
    if (!confirmed) return;
    try {
      await adminApiRequest(`/api/admin/fee-fine-rules/${rule.id}`, { method: "DELETE" });
      popup.success("Fine rule deleted");
      await load();
    } catch (err) {
      popup.error("Could not delete rule", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  return (
    <>
      <PageHeader
        title="Fee Fine Rules"
        description="Configure late-payment and overdue-installment penalties with grace periods and caps."
      />

      <section className="space-y-4 p-4 md:p-7">
        {error && (
          <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {rules.filter((rule) => rule.active).length} active of {rules.length} rules
          </p>
          {canCreate && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((value) => !value)}>
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Close" : "Add fine rule"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">
              Rule name
              <input
                className="field mt-1"
                required
                maxLength={120}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Late fee — term 1"
              />
            </label>
            <label className="text-sm font-semibold">
              Applies to
              <select
                className="field mt-1"
                value={form.scope}
                onChange={(event) => setForm({ ...form, scope: event.target.value as FormState["scope"] })}
              >
                {FEE_FINE_SCOPES.map((scope) => (
                  <option key={scope} value={scope}>{FEE_FINE_SCOPE_LABELS[scope]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Grace days
              <input
                className="field mt-1"
                type="number"
                min={0}
                max={90}
                value={form.graceDays}
                onChange={(event) => setForm({ ...form, graceDays: event.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Fine type
              <select
                className="field mt-1"
                value={form.fineType}
                onChange={(event) => setForm({ ...form, fineType: event.target.value as FormState["fineType"] })}
              >
                {FEE_FINE_TYPES.map((type) => (
                  <option key={type} value={type}>{FEE_FINE_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Amount {form.fineType === "percent" ? "(%)" : "(₹)"}
              <input
                className="field mt-1"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Frequency
              <select
                className="field mt-1"
                value={form.frequency}
                onChange={(event) => setForm({ ...form, frequency: event.target.value as FormState["frequency"] })}
              >
                {FEE_FINE_FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>{FEE_FINE_FREQUENCY_LABELS[frequency]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Maximum fine (₹, 0 = no cap)
              <input
                className="field mt-1"
                type="number"
                min={0}
                step="0.01"
                value={form.maxFine}
                onChange={(event) => setForm({ ...form, maxFine: event.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Academic year
              <select
                className="field mt-1"
                value={form.academicYearId}
                onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}
              >
                <option value="">All years</option>
                {years.filter((year) => year.id).map((year) => (
                  <option key={year.id} value={year.id}>{year.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Active immediately
            </label>
            <div className="flex justify-end gap-3 sm:col-span-2 lg:col-span-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save rule"}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            No fine rules configured yet. Add one to apply penalties on late fee payments.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Applies to</th>
                  <th className="px-4 py-3">Grace</th>
                  <th className="px-4 py-3">Fine</th>
                  <th className="px-4 py-3">Cap</th>
                  <th className="px-4 py-3">Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold">{rule.name}</td>
                    <td className="px-4 py-3">{FEE_FINE_SCOPE_LABELS[rule.scope]}</td>
                    <td className="px-4 py-3">{rule.graceDays} day{rule.graceDays === 1 ? "" : "s"}</td>
                    <td className="px-4 py-3">
                      {rule.fineType === "percent" ? `${rule.amount}%` : `₹${rule.amount}`}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {FEE_FINE_FREQUENCY_LABELS[rule.frequency]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{rule.maxFine > 0 ? `₹${rule.maxFine}` : "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => void toggleActive(rule)}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${rule.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}
                      >
                        {rule.active ? "Active" : "Paused"}
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void remove(rule)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card flex items-start gap-3 p-4 text-xs font-medium text-muted-foreground">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>
            Rules here are the policy master. Fines are calculated at collection time using the rule&apos;s grace
            period, frequency and cap — no student balances are touched until a payment is recorded.
          </p>
        </div>
      </section>
    </>
  );
}
