"use client";

import { DatePicker } from "@/components/DatePicker";
import { auth } from "@sri-narayana/shared/firebase/client";
import { AlertTriangle, CalendarOff, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Branch = {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
};

/**
 * Super Admin "Declare Holiday" button + modal for sudden management-declared
 * holidays (heavy rain, government order, emergencies). Declared holidays block
 * teacher check-in/check-out and are excluded from payroll working days.
 */
export function DeclareHolidayModal({ onDeclared }: { onDeclared?: () => void }) {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const loadBranches = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch("/api/admin/branches", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (response.ok && Array.isArray(result.branches)) setBranches(result.branches);
      } catch {
        // Branch list is optional — the "All schools / branches" option always works.
      }
    };
    void loadBranches();
  }, [open]);

  const declareHoliday = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    if (toDate < fromDate) {
      setError("To date cannot be before from date.");
      setSaving(false);
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in as Super Admin again.");
      const response = await fetch("/api/admin/holidays/declare", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromDate, toDate, reason, branchId, appliesToAllBranches: !branchId })
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "Unable to declare holiday");
      setMessage(result.message ?? "Holiday declared successfully.");
      setOpen(false);
      setReason("");
      setBranchId("");
      onDeclared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to declare holiday");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="btn-primary" onClick={() => { setOpen(true); setError(null); setMessage(null); }}>
        <CalendarOff size={16} /> Declare Holiday
      </button>
      {message && !open && (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52] shadow-lg">
          {message}
          <button className="ml-3 text-xs font-bold text-[#0f8d52] underline" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#101228]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl" onSubmit={declareHoliday}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">Declare Holiday</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                  Emergency / management declared holiday. Teacher check-in is blocked and payroll excludes this date from working days.
                </p>
              </div>
              <button type="button" aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#303247]">
                From date
                <div className="mt-1">
                  <DatePicker
                    value={fromDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFromDate(value);
                      if (toDate < value) setToDate(value);
                    }}
                    required
                  />
                </div>
              </label>
              <label className="block text-sm font-semibold text-[#303247]">
                To date
                <div className="mt-1">
                  <DatePicker
                    value={toDate}
                    min={fromDate}
                    onChange={(event) => setToDate(event.target.value)}
                    required
                  />
                </div>
              </label>
            </div>

            <label className="block text-sm font-semibold text-[#303247]">
              Reason
              <input
                className="field mt-1 w-full"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Heavy rain, Government order, Festival"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-[#303247]">
              Apply to
              <select className="field mt-1 w-full" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">All schools / branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.code ?? branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" disabled={saving}>
                <CalendarOff size={16} /> {saving ? "Declaring..." : "Declare Holiday"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
