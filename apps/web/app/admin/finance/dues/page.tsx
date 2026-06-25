"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type ClassDues = { className: string; studentCount: number; totalDue: number; students: { id: string; name: string; due: number }[] };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function DuesPage() {
  const { role } = useAdminSession();
  const [classes, setClasses] = useState<ClassDues[]>([]);
  const [grand, setGrand] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { const r = await adminApiRequest<{ classes: ClassDues[]; grandTotalDue: number }>("/api/admin/finance/dues"); setClasses(r.classes); setGrand(r.grandTotalDue); }
      catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Outstanding Dues" description="Fee dues grouped by class." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="card flex items-center justify-between p-5"><span className="font-semibold text-[#7d86a8]">Total outstanding</span><span className="text-2xl font-extrabold text-[#e29813]">{inr(grand)}</span></div>
        <div className="space-y-3">
          {loading ? <div className="card p-8 text-center text-stone-400">Loading…</div>
          : classes.length === 0 ? <div className="card p-8 text-center text-stone-400">No outstanding dues 🎉</div>
          : classes.map((c) => (
            <div key={c.className} className="card overflow-hidden">
              <button onClick={() => setOpen(open === c.className ? null : c.className)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-stone-50">
                <span className="flex items-center gap-2 font-bold text-[#1f2136]">{open === c.className ? <ChevronDown size={18} /> : <ChevronRight size={18} />} Class {c.className}<span className="ml-2 text-xs font-medium text-stone-400">{c.studentCount} students</span></span>
                <span className="font-bold text-[#e29813]">{inr(c.totalDue)}</span>
              </button>
              {open === c.className && (
                <div className="divide-y divide-stone-100 border-t border-stone-100">
                  {c.students.map((s) => (<div key={s.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="text-[#303247]">{s.name}</span><span className="font-semibold text-[#ed515d]">{inr(s.due)}</span></div>))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
