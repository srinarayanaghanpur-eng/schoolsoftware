"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

type DueStudent = { id: string; name: string; phone?: string; parentName?: string; due: number };
type ClassDues = { className: string; studentCount: number; totalDue: number; students: DueStudent[] };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

function reminderText(s: DueStudent, className: string): string {
  return `Dear ${s.parentName || "Parent"}, this is a reminder from Sri Narayana High School. Fee of ${inr(s.due)} is outstanding for ${s.name} (Class ${className}). Kindly pay at the earliest. Thank you.`;
}

function openWhatsApp(s: DueStudent, className: string) {
  const cleaned = sanitizePhone(s.phone || "");
  if (!cleaned) return;
  const number = cleaned.length === 10 ? `91${cleaned}` : cleaned;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(reminderText(s, className))}`, "_blank");
}

export default function DuesPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [classes, setClasses] = useState<ClassDues[]>([]);
  const [grand, setGrand] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedYear?.id) {
      setClasses([]);
      setGrand(0);
      setLoading(false);
      return;
    }
    const academicYearId = selectedYear.id;
    (async () => {
      try {
        const params = new URLSearchParams({ academicYearId, pageSize: "25" });
        const r = await adminApiRequest<{ classes: ClassDues[]; grandTotalDue: number }>(`/api/admin/finance/dues?${params}`);
        setClasses(r.classes);
        setGrand(r.grandTotalDue);
      }
      catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [selectedYear?.id]);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Outstanding Dues" description="Fee dues grouped by class." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load outstanding dues.</div>}
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
                  {c.students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[#303247]">{s.name}</span>
                        {s.phone && <span className="block truncate text-xs text-stone-400">{s.parentName ? `${s.parentName} · ` : ""}{s.phone}</span>}
                      </div>
                      <span className="font-semibold text-[#ed515d]">{inr(s.due)}</span>
                      {s.phone && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => openWhatsApp(s, c.className)} title="Send WhatsApp reminder" className="grid h-8 w-8 place-items-center rounded-lg text-[#25D366] transition hover:bg-[#25D366]/10">
                            <MessageCircle size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
