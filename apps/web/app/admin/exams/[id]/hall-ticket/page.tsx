"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { Printer, Download, Search, User } from "lucide-react";
import { useEffect, useState, useRef } from "react";

type HallTicket = {
  examName: string;
  examType: string;
  startDate: string;
  endDate?: string;
  studentId?: string;
  studentName: string;
  className: string;
  section?: string;
  admissionNo?: string;
  studentPhoto?: string | null;
  timetable: { subject: string; date: string; time: string; maxMarks?: number }[];
  generalInstructions: string[];
};

function HallTicketCard({ ticket, compact }: { ticket: HallTicket; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border-2 border-primary/20 bg-white p-6 shadow-lg dark:bg-stone-900 print:shadow-none">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">Hall Ticket</h2>
        <p className="text-xl font-bold text-foreground">{ticket.examName}</p>
        <p className="text-sm text-muted-foreground">{formatLabel(ticket.examType)}</p>
      </div>

      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted">
          {ticket.studentPhoto ? (
            <img src={ticket.studentPhoto} alt="" className="h-full w-full rounded-xl object-cover" />
          ) : (
            <User size={32} className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-foreground">{ticket.studentName}</p>
          <p className="text-sm text-muted-foreground">
            Class {ticket.className}{ticket.section ? ` - ${ticket.section}` : ""}
          </p>
          {ticket.admissionNo && (
            <p className="text-sm text-muted-foreground">Admission No: {ticket.admissionNo}</p>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg bg-muted p-3">
        <p className="text-sm font-semibold text-foreground">
          {ticket.startDate}{ticket.endDate ? ` to ${ticket.endDate}` : ""}
        </p>
      </div>

      {ticket.timetable.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-extrabold text-foreground">Exam Schedule</h3>
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="rounded-l-lg px-3 py-2">Subject</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Time</th>
                {ticket.timetable.some((t) => t.maxMarks) && <th className="rounded-r-lg px-3 py-2">Max Marks</th>}
              </tr>
            </thead>
            <tbody>
              {ticket.timetable.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{t.subject}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.date}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.time}</td>
                  {t.maxMarks && <td className="px-3 py-2 text-muted-foreground">{t.maxMarks}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-extrabold text-foreground">General Instructions</h3>
        <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
          {ticket.generalInstructions.map((inst, i) => (
            <li key={i}>{inst}</li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex justify-between border-t border-dashed border-border pt-4 text-[10px] text-muted-foreground">
        <span>Student's Signature</span>
        <span>Invigilator's Signature</span>
      </div>
    </div>
  );
}

export default function HallTicketPage({ params }: { params: { id: string } }) {
  const { role } = useAdminSession();
  const [tickets, setTickets] = useState<HallTicket[]>([]);
  const [exam, setExam] = useState<{ name: string; className: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [examData, ticketData] = await Promise.all([
          adminApiRequest<{ ok: true; exam: { name: string; className: string } }>(`/api/admin/exams/${params.id}`),
          adminApiRequest<{ ok: true; hallTickets: HallTicket[] }>(`/api/admin/exams/${params.id}/hall-ticket`),
        ]);
        setExam(examData.exam);
        setTickets(ticketData.hallTickets || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [params.id]);

  if (!hasPermission(role, "exams.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  const filtered = tickets.filter((t) =>
    !searchTerm || t.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || t.admissionNo?.includes(searchTerm)
  );

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Hall Tickets - ${exam?.name || "Exam"}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        @media print { @page { margin: 10mm; } }
      </style></head><body>
      ${tickets.map((t) => `<div style="page-break-after: always;">${document.getElementById(`ticket-${t.studentId}`)?.outerHTML || ""}</div>`).join("")}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <>
      <PageHeader title="Hall Tickets" description={exam ? `${exam.name} · Class ${exam.className}` : ""} />

      <section className="space-y-4 p-4 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field !pl-9"
              placeholder="Search by name or admission no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handlePrint} disabled={tickets.length === 0}>
              <Printer size={16} /> Print All ({tickets.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-stone-400">
            {tickets.length === 0 ? "No students found for this exam." : "No students match your search."}
          </div>
        ) : (
          <div ref={printRef} className="grid gap-6 md:grid-cols-2">
            {filtered.map((ticket) => (
              <div key={ticket.studentId} id={`ticket-${ticket.studentId}`}>
                <HallTicketCard ticket={ticket} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
