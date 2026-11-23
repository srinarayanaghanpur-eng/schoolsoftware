"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { numberToIndianWords } from "@/lib/amountInWords";
import { CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { SCHOOL_CONTACT, hasPermission } from "@sri-narayana/shared";
import { ChevronDown, ChevronRight, FileStack, MessageCircle, Printer } from "lucide-react";
import { useEffect, useState } from "react";

type DueStudent = { id: string; name: string; phone?: string; parentName?: string; due: number };
type ClassDues = { className: string; studentCount: number; totalDue: number; students: DueStudent[] };
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
};
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
function isoDate(offsetDays = 7) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

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
  const popup = usePopup();
  const [classes, setClasses] = useState<ClassDues[]>([]);
  const [grand, setGrand] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [slips, setSlips] = useState<DueSlip[]>([]);
  const [generating, setGenerating] = useState(false);
  const [slipClassId, setSlipClassId] = useState("");
  const [slipDueDate, setSlipDueDate] = useState(isoDate());
  const canGenerate = hasPermission(role, "fees.create");

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

  useEffect(() => {
    (async () => {
      try {
        const data = await adminApiRequest<{ slips: DueSlip[] }>("/api/admin/finance/due-slips");
        setSlips(data.slips ?? []);
      } catch {
        setSlips([]);
      }
    })();
  }, []);

  const generateSlips = async () => {
    if (!selectedYear?.id) {
      popup.error("Select an academic year");
      return;
    }
    setGenerating(true);
    try {
      const result = await adminApiRequest<{ generated: number }>("/api/admin/finance/due-slips", {
        method: "POST",
        body: JSON.stringify({ academicYearId: selectedYear.id, classId: slipClassId, dueDate: slipDueDate })
      });
      if (result.generated === 0) popup.info("No outstanding students", "Nothing to generate for this selection.");
      else popup.success("Due slips generated", `${result.generated} slip(s) ready.`);
      const data = await adminApiRequest<{ slips: DueSlip[] }>("/api/admin/finance/due-slips");
      setSlips(data.slips ?? []);
    } catch (err) {
      popup.error("Could not generate", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <style>{`
        .due-slip-print { width: 210mm; min-height: 148mm; padding: 12mm 14mm; background: #fff; color: #000; font-size: 11.5pt; font-family: Arial, Helvetica, sans-serif; }
        .due-slip-print + .due-slip-print { page-break-before: always; }
        .due-slip-print table { width: 100%; border-collapse: collapse; }
        .due-slip-print th, .due-slip-print td { border: 1px solid #000; padding: 2mm 3mm; text-align: left; }
        .due-slip-print .due-slip-amount { text-align: right; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden; }
          .due-slip-print-area, .due-slip-print-area * { visibility: visible; }
          .due-slip-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <PageHeader title="Dues & Due Slips" description="Outstanding fees by class, plus printable due slips." />
      <div className="due-slip-print-area hidden print:block">
        {slips.map((slip) => (
          <article key={slip.id} className="due-slip-print">
            <div className="flex items-center gap-4 border-b-2 border-black pb-3">
              <img src="/sri-narayana-high-school-logo.jpg" alt="" className="h-16 w-16 shrink-0 object-contain" />
              <div className="min-w-0 flex-1 text-center">
                <h1 className="text-[17pt] font-bold leading-tight">{SCHOOL_CONTACT.name.toUpperCase()}</h1>
                <p className="text-[10pt]">{SCHOOL_CONTACT.address}</p>
                <p className="text-[10pt]">Ph: {SCHOOL_CONTACT.phone}</p>
              </div>
            </div>

            <h2 className="mt-4 text-center text-[13pt] font-bold tracking-wide">FEE DUE SLIP</h2>

            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5">
              <div>Slip No.: <b>{slip.slipNumber}</b></div>
              <div>Due Date: <b>{slip.dueDate || "—"}</b></div>
              <div>Student Name: <b>{slip.studentName}</b></div>
              <div>Class: <b>{slip.className}{slip.section ? `-${slip.section}` : ""}</b></div>
              <div>Admission No.: <b>{slip.admissionNumber}</b></div>
              <div>Status: <b>{slip.status || "Pending"}</b></div>
            </div>

            <table className="mt-3">
              <thead>
                <tr>
                  <th>Fee Particulars</th>
                  <th className="due-slip-amount">Total (₹)</th>
                  <th className="due-slip-amount">Paid (₹)</th>
                  <th className="due-slip-amount">Due (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Outstanding fees</td>
                  <td className="due-slip-amount">{inr(Number(slip.amount) || 0)}</td>
                  <td className="due-slip-amount">{inr(0)}</td>
                  <td className="due-slip-amount">{inr(Number(slip.amount) || 0)}</td>
                </tr>
                <tr>
                  <td className="font-bold">TOTAL DUE</td>
                  <td className="due-slip-amount font-bold">{inr(Number(slip.amount) || 0)}</td>
                  <td className="due-slip-amount font-bold">{inr(0)}</td>
                  <td className="due-slip-amount font-bold">{inr(Number(slip.amount) || 0)}</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3">Amount due in words: <b>{numberToIndianWords(Number(slip.amount) || 0)}</b></p>
            <p className="mt-1">Please pay the due amount on or before <b>{slip.dueDate || "the due date"}</b>.</p>

            <div className="mt-10 flex justify-between gap-6 text-center text-[10pt]">
              <div className="flex-1 border-t border-black pt-1.5">Parent Signature</div>
              <div className="flex-1 border-t border-black pt-1.5">Accountant</div>
            </div>

            <p className="mt-6 text-center text-[9pt]">This is computer generated valid receipt.</p>
          </article>
        ))}
      </div>
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load outstanding dues.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="card flex items-center justify-between p-5"><span className="font-semibold text-[#7d86a8]">Total outstanding</span><span className="text-2xl font-extrabold text-[#e29813]">{inr(grand)}</span></div>

        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            Class
            <select className="field mt-1" value={slipClassId} onChange={(event) => setSlipClassId(event.target.value)}>
              <option value="">All classes</option>
              {CLASS_SELECTOR_CLASSES.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pay by
            <input className="field mt-1" type="date" value={slipDueDate} onChange={(event) => setSlipDueDate(event.target.value)} />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              className="btn-primary inline-flex w-full items-center justify-center gap-2"
              onClick={() => void generateSlips()}
              disabled={!canGenerate || generating || !selectedYear?.id}
            >
              <FileStack size={16} />
              {generating ? "Generating…" : "Generate due slips"}
            </button>
          </div>
        </div>

        {slips.length > 0 && (
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Generated due slips</h2>
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => window.print()} disabled={slips.length === 0}>
                <Printer size={15} /> Print all
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Slip</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Pay by</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => (
                  <tr key={slip.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold">{slip.slipNumber}</td>
                    <td className="px-4 py-3">{slip.studentName} <span className="text-xs text-muted-foreground">{slip.admissionNumber}</span></td>
                    <td className="px-4 py-3">{slip.className}{slip.section ? `-${slip.section}` : ""}</td>
                    <td className="px-4 py-3 font-semibold">{inr(Number(slip.amount) || 0)}</td>
                    <td className="px-4 py-3">{slip.dueDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
