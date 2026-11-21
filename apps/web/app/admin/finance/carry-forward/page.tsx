"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { useState } from "react";

type CarryStudent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  dueAmount: number;
};

type Preview = {
  students: CarryStudent[];
  totals: { students: number; totalDue: number };
  byClass: { className: string; count: number; totalDue: number }[];
  truncated: boolean;
};

export default function CarryForwardPage() {
  const { role } = useAdminSession();
  const { years } = useAcademicYears();
  const popup = usePopup();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const canApply = hasPermission(role, "fees.edit");

  const loadPreview = async () => {
    if (!source) {
      setError("Choose the year to carry dues from.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sourceAcademicYearId: source });
      if (target) params.set("targetAcademicYearId", target);
      const data = await adminApiRequest<Preview & { ok: boolean }>(`/api/admin/fee-carry-forward?${params}`, undefined, { fresh: true });
      setPreview(data);
      setSelected(new Set(data.students.map((student) => student.studentId)));
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load outstanding dues");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!source || !target) {
      popup.error("Pick both years", "Source and target academic years are required.");
      return;
    }
    if (selected.size === 0) {
      popup.error("No students selected");
      return;
    }
    const confirmed = await popup.confirm(
      "Carry forward dues?",
      `${selected.size} student(s) will have their outstanding balance moved from ${yearName(source)} to ${yearName(target)}.`,
      { okLabel: "Carry forward" }
    );
    if (!confirmed) return;
    setApplying(true);
    try {
      const result = await adminApiRequest<{ applied: number; skipped: number; totalCarried: number }>(
        "/api/admin/fee-carry-forward",
        {
          method: "POST",
          body: JSON.stringify({
            sourceAcademicYearId: source,
            targetAcademicYearId: target,
            studentIds: Array.from(selected)
          })
        }
      );
      popup.success(
        "Dues carried forward",
        `${result.applied} student(s) · ₹${result.totalCarried.toLocaleString("en-IN")}${result.skipped ? ` · ${result.skipped} skipped` : ""}`
      );
      await loadPreview();
    } catch (err) {
      popup.error("Could not carry forward", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const yearName = (id: string) => years.find((year) => year.id === id)?.name ?? id;

  const toggle = (studentId: string) => {
    const next = new Set(selected);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    setSelected(next);
  };

  return (
    <>
      <PageHeader
        title="Fees Carry Forward"
        description="Move unpaid balances from a closed academic year into the new year's fee summary."
      />

      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            From year
            <select className="field mt-1" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Select year</option>
              {years.filter((year) => year.id).map((year) => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            To year
            <select className="field mt-1" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Select year</option>
              {years.filter((year) => year.id).map((year) => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3 sm:col-span-2">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => void loadPreview()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Preview dues"}
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => void apply()}
              disabled={!canApply || applying || selected.size === 0 || !source || !target}
            >
              <ArrowRightLeft size={16} />
              {applying ? "Carrying…" : `Carry ${selected.size || ""} student(s)`}
            </button>
          </div>
        </div>

        {preview && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Students</p>
                <p className="mt-1 text-2xl font-extrabold">{preview.totals.students}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total outstanding</p>
                <p className="mt-1 text-2xl font-extrabold">₹{preview.totals.totalDue.toLocaleString("en-IN")}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Classes affected</p>
                <p className="mt-1 text-2xl font-extrabold">{preview.byClass.length}</p>
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === preview.students.length && preview.students.length > 0}
                        onChange={(event) =>
                          setSelected(event.target.checked ? new Set(preview.students.map((student) => student.studentId)) : new Set())
                        }
                      />
                    </th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.students.map((student) => (
                    <tr key={student.studentId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(student.studentId)}
                          onChange={() => toggle(student.studentId)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {student.studentName}
                        <span className="ml-1 text-xs font-medium text-muted-foreground">{student.admissionNumber}</span>
                      </td>
                      <td className="px-4 py-3">{student.className}{student.sectionName ? `-${student.sectionName}` : ""}</td>
                      <td className="px-4 py-3 font-semibold">₹{student.dueAmount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.truncated && (
              <p className="text-xs font-medium text-amber-600">
                Showing the highest 300 outstanding balances. Carry these forward, then preview again for the rest.
              </p>
            )}
          </>
        )}

        {!preview && !loading && (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            Pick a source year and preview the outstanding balances to carry forward.
          </div>
        )}
      </section>
    </>
  );
}
