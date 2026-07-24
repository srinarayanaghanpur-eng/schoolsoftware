"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type Defaulter = { id: string; studentName: string; className: string; admissionNumber: string; totalDue: number; lastPaymentDate: string | null; daysOverdue: number };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const CLASS_OPTIONS = ["", "Nur", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export default function DefaultersPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [data, setData] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const fetchData = async (cls: string) => {
    if (!selectedYear?.id) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" });
      if (cls) params.set("class", cls);
      const r = await adminApiRequest<{ data: Defaulter[] }>(`/api/admin/finance/defaulters?${params}`);
      setData(r.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(classFilter); }, [classFilter, selectedYear?.id]);

  if (!hasPermission(role, "fees.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Defaulters List" description="Students with outstanding fee dues." />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load defaulters.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="card flex flex-wrap items-end gap-4 p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#303247]">
            <Search size={16} />
            Class
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="field ml-2">
              <option value="">All Classes</option>
              {CLASS_OPTIONS.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <span className="text-sm font-medium text-[#7d86a8]">{data.length} student{data.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f8fd]">
                <tr>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Student Name</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Class</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Admission No</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Total Due</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Last Payment</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No defaulters found 🎉</td></tr>
                ) : (
                  data.map((d) => (
                    <tr key={d.id} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                      <td className="px-4 py-3 font-medium text-[#303247]">{d.studentName}</td>
                      <td className="px-4 py-3 text-[#6f7898]">{d.className}</td>
                      <td className="px-4 py-3 text-[#6f7898]">{d.admissionNumber}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#ed515d]">{inr(d.totalDue)}</td>
                      <td className="px-4 py-3 text-[#6f7898]">{fmt(d.lastPaymentDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${d.daysOverdue > 90 ? "bg-[#ffebed] text-[#ed515d]" : d.daysOverdue > 30 ? "bg-[#fff4df] text-[#e29813]" : "bg-[#e6f8ef] text-[#14a762]"}`}>
                          {d.daysOverdue > 0 ? `${d.daysOverdue}d` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
