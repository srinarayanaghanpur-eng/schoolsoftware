"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { hasPermission } from "@sri-narayana/shared";
import { FileStack, Printer } from "lucide-react";
import { useEffect, useState } from "react";

type DueSlip = {
  id: string;
  slipNumber: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  section: string;
  amount: number;
  dueDate: string;
  status: string;
  createdAt?: unknown;
};

function isoDate(offsetDays = 7) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function DueSlipsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const popup = usePopup();
  const [slips, setSlips] = useState<DueSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState(isoDate());

  const canGenerate = hasPermission(role, "fees.create");

  const load = async () => {
    try {
      const data = await adminApiRequest<{ slips: DueSlip[] }>("/api/admin/finance/due-slips");
      setSlips(data.slips ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load due slips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const generate = async () => {
    if (!selectedYear?.id) {
      popup.error("Select an academic year");
      return;
    }
    setGenerating(true);
    try {
      const result = await adminApiRequest<{ generated: number }>("/api/admin/finance/due-slips", {
        method: "POST",
        body: JSON.stringify({ academicYearId: selectedYear.id, classId, dueDate })
      });
      if (result.generated === 0) popup.info("No outstanding students", "Nothing to generate for this selection.");
      else popup.success("Due slips generated", `${result.generated} slip(s) ready.`);
      await load();
    } catch (err) {
      popup.error("Could not generate", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader title="Due Slips" description="Generate printable outstanding-fee slips for classes or the whole school." />

      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            Academic year
            <div className="field mt-1 flex items-center">{selectedYear?.name ?? "Select from the top bar"}</div>
          </label>
          <label className="text-sm font-semibold">
            Class
            <select className="field mt-1" value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {CLASS_SELECTOR_CLASSES.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pay by
            <input className="field mt-1" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary inline-flex w-full items-center justify-center gap-2"
              onClick={() => void generate()}
              disabled={!canGenerate || generating || !selectedYear?.id}
            >
              <FileStack size={16} />
              {generating ? "Generating…" : "Generate due slips"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : slips.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">No due slips generated yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Slip</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Pay by</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => (
                  <tr key={slip.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold">{slip.slipNumber}</td>
                    <td className="px-4 py-3">
                      {slip.studentName}
                      <span className="ml-1 text-xs text-muted-foreground">{slip.admissionNumber}</span>
                    </td>
                    <td className="px-4 py-3">{slip.className}{slip.section ? `-${slip.section}` : ""}</td>
                    <td className="px-4 py-3 font-semibold">₹{(Number(slip.amount) || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">{slip.dueDate || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-bold"
                        onClick={() => window.print()}
                      >
                        <Printer size={14} /> Print
                      </button>
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
