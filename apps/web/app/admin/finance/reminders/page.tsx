"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import {
  buildFeeReminderMessage,
  cleanPhoneNumber,
  formatCurrency,
  openGoogleMessagesReminder,
  openWhatsAppReminder
} from "@/lib/feeReminderHelpers";
import { hasPermission } from "@sri-narayana/shared";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReminderChannel = "whatsapp" | "google_messages";

type FeeTypeDue = {
  id: string;
  feeType: string;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  dueDate: string | null;
};

type ReminderStudent = {
  id: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  parentName: string;
  parentMobile: string;
  className: string;
  sectionName: string;
  totalDue: number;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  lastPaymentDate: string | null;
};

type ReminderStudentDetail = ReminderStudent & {
  feeTypes: FeeTypeDue[];
};

type ClassReminderDues = {
  key: string;
  classId: string;
  className: string;
  studentCount: number;
  totalDue: number;
  students: ReminderStudent[];
};

type ReminderResponse = {
  ok: true;
  classes: ClassReminderDues[];
  grandTotalDue: number;
  studentsWithDues: number;
  truncated?: boolean;
};

type StudentDetailResponse = {
  ok: true;
  student: ReminderStudentDetail;
};

function formatDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function classDisplay(student: Pick<ReminderStudent, "className" | "sectionName">) {
  return `${student.className || "--"}${student.sectionName || ""}`;
}

function detailLine(label: string, value: string) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.02em] text-[#7d86a8]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-extrabold text-[#1f2136]">{value || "--"}</dd>
    </div>
  );
}

export default function RemindersPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canSend = hasPermission(role, "fees.create");
  const [classes, setClasses] = useState<ClassReminderDues[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<ReminderStudentDetail | null>(null);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<ReminderChannel | null>(null);
  const [truncated, setTruncated] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYear?.id) {
      setClasses([]);
      setSelectedClassKey(null);
      setSelectedStudentId(null);
      setStudentDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "500" });
      const result = await adminApiRequest<ReminderResponse>(`/api/admin/finance/reminders?${params}`);
      setClasses(result.classes);
      setTruncated(Boolean(result.truncated));
      setSelectedClassKey((current) => current && result.classes.some((item) => item.key === current) ? current : result.classes[0]?.key ?? null);
      setSelectedStudentId((current) => {
        if (!current || result.classes.some((item) => item.students.some((student) => student.id === current))) return current;
        setStudentDetail(null);
        return null;
      });
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load fee reminders");
    } finally {
      setLoading(false);
    }
  }, [selectedYear?.id]);

  useEffect(() => { void load(); }, [load]);

  const visibleClasses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return classes;
    return classes
      .map((entry) => {
        const classMatches = entry.className.toLowerCase().includes(needle);
        const students = classMatches
          ? entry.students
          : entry.students.filter((student) => [
            student.studentName,
            student.admissionNumber,
            student.rollNumber,
            student.parentName,
            student.parentMobile,
            classDisplay(student)
          ].join(" ").toLowerCase().includes(needle));
        return classMatches || students.length > 0 ? { ...entry, students } : null;
      })
      .filter(Boolean) as ClassReminderDues[];
  }, [classes, search]);

  const selectedClass = useMemo(() => {
    return visibleClasses.find((entry) => entry.key === selectedClassKey) ?? visibleClasses[0] ?? null;
  }, [selectedClassKey, visibleClasses]);

  const grandTotal = useMemo(() => classes.reduce((sum, entry) => sum + entry.totalDue, 0), [classes]);
  const studentsWithDues = useMemo(() => classes.reduce((sum, entry) => sum + entry.studentCount, 0), [classes]);

  const selectedFeeOptions = useMemo(() => {
    if (!studentDetail) return [];
    return [
      {
        id: "all",
        feeType: "All Pending Fees",
        totalFee: studentDetail.totalFee,
        paidAmount: studentDetail.paidAmount,
        concessionAmount: studentDetail.concessionAmount,
        dueAmount: studentDetail.totalDue,
        dueDate: null
      },
      ...studentDetail.feeTypes
    ];
  }, [studentDetail]);

  const selectedFee = selectedFeeOptions.find((fee) => fee.id === selectedFeeId) ?? selectedFeeOptions[0] ?? null;
  const reminderMessage = studentDetail && selectedFee ? buildFeeReminderMessage(studentDetail, selectedFee) : "";
  const hasMobile = Boolean(studentDetail && cleanPhoneNumber(studentDetail.parentMobile));

  async function syncDues() {
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    setSyncing(true);
    setError("");
    setMsg("");
    try {
      const result = await adminApiRequest<{ synced: number }>("/api/admin/finance/sync-summaries", {
        method: "POST",
        body: JSON.stringify({ academicYearId: selectedYear.id })
      });
      setMsg(`Synced fee data for ${result.synced} student(s).`);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function openStudent(studentId: string) {
    if (!selectedYear?.id) return;
    setSelectedStudentId(studentId);
    setStudentDetail(null);
    setDetailLoading(true);
    setError("");
    setMsg("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, studentId });
      const result = await adminApiRequest<StudentDetailResponse>(`/api/admin/finance/reminders?${params}`, undefined, { fresh: true });
      setStudentDetail(result.student);
      setSelectedFeeId(result.student.feeTypes[0]?.id ?? "all");
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load student fee details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function logReminder(channel: ReminderChannel) {
    if (!selectedYear?.id || !studentDetail || !selectedFee) return;
    await adminApiRequest<{ ok: true; id: string }>("/api/admin/finance/reminders", {
      method: "POST",
      body: JSON.stringify({
        studentId: studentDetail.id,
        studentName: studentDetail.studentName,
        parentMobile: studentDetail.parentMobile,
        feeType: selectedFee.feeType,
        dueAmount: selectedFee.dueAmount,
        channel,
        academicYearId: selectedYear.id
      })
    });
  }

  async function sendReminder(channel: ReminderChannel) {
    if (!studentDetail || !selectedFee || !reminderMessage || !hasMobile) return;
    setSendingChannel(channel);
    setError("");
    setMsg("");
    try {
      if (channel === "whatsapp") {
        openWhatsAppReminder(studentDetail.parentMobile, reminderMessage);
        await logReminder(channel);
        setMsg("WhatsApp opened with the reminder message. Please press send manually.");
      } else {
        await openGoogleMessagesReminder(studentDetail.parentMobile, reminderMessage);
        await logReminder(channel);
        setMsg(`Message copied. Open Google Messages, select/start chat with ${studentDetail.parentMobile}, paste and send.`);
      }
      setSendSheetOpen(false);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Unable to open reminder channel");
    } finally {
      setSendingChannel(null);
    }
  }

  if (!hasPermission(role, "fees.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Fee Reminders"
        description="Class-wise dues and manual WhatsApp or Google Messages reminders."
        action={canSend ? (
          <button className="btn-secondary" onClick={syncDues} disabled={syncing || !selectedYear?.id} title="Rebuild dues list from student records">
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync dues"}
          </button>
        ) : null}
      />

      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load fee reminders.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {msg && <div className="card border-l-4 border-l-[#14a762] p-4 text-sm font-semibold text-[#14a762]">{msg}</div>}
        {truncated && <div className="card border-l-4 border-l-[#e29813] p-4 text-sm font-semibold text-[#9f7116]">Showing the first 500 due summaries. Narrow by academic year/class if needed.</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#7d86a8]"><ReceiptText size={16} /> Total Due</p>
            <p className="mt-2 text-2xl font-extrabold text-[#ed515d]">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#7d86a8]"><Users size={16} /> Students With Dues</p>
            <p className="mt-2 text-2xl font-extrabold text-[#1f2136]">{studentsWithDues}</p>
          </div>
          <label className="card flex items-center gap-3 p-4">
            <Search size={18} className="shrink-0 text-[#7d86a8]" />
            <span className="sr-only">Search class or student</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#303247] outline-none placeholder:text-[#9aa4c4]"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search class, student, mobile"
            />
          </label>
        </div>

        {loading ? (
          <div className="card flex items-center justify-center gap-2 p-8 text-sm font-semibold text-[#7d86a8]">
            <Loader2 size={18} className="animate-spin" /> Loading fee reminders...
          </div>
        ) : classes.length === 0 ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">No pending dues found.</div>
        ) : (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <h2 className="px-1 text-sm font-extrabold uppercase tracking-[0.02em] text-[#7d86a8]">Class-wise dues</h2>
              <div className="space-y-2">
                {visibleClasses.length === 0 ? (
                  <div className="card p-5 text-center text-sm font-semibold text-[#7d86a8]">No pending dues found.</div>
                ) : visibleClasses.map((entry) => {
                  const active = selectedClass?.key === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setSelectedClassKey(entry.key)}
                      className={`card w-full p-4 text-left transition ${active ? "border-[#3033a1] bg-[#eef0ff]" : "hover:bg-[#f7f8fd]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-extrabold text-[#1f2136]">Class {entry.className}</p>
                          <p className="mt-1 text-xs font-semibold text-[#7d86a8]">{entry.studentCount} student{entry.studentCount === 1 ? "" : "s"} with dues</p>
                        </div>
                        <ChevronRight size={18} className={active ? "text-[#3033a1]" : "text-[#9aa4c4]"} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#ed515d]">{formatCurrency(entry.totalDue)}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#3033a1] ring-1 ring-[#dfe3f1]">View Students</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              {selectedClass && (
                <section className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#1f2136]">Class {selectedClass.className}</h2>
                      <p className="text-sm font-semibold text-[#7d86a8]">{selectedClass.students.length} shown · {formatCurrency(selectedClass.totalDue)} total due</p>
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {selectedClass.students.length === 0 ? (
                      <div className="card p-6 text-center text-sm font-semibold text-[#7d86a8]">No pending dues found.</div>
                    ) : selectedClass.students.map((student) => (
                      <article key={student.id} className={`card p-4 ${selectedStudentId === student.id ? "border-[#3033a1]" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-extrabold text-[#1f2136]">{student.studentName || "--"}</h3>
                            <p className="mt-1 text-xs font-semibold text-[#7d86a8]">{student.admissionNumber || "No admission no."}{student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}</p>
                          </div>
                          <span className="shrink-0 text-sm font-extrabold text-[#ed515d]">{formatCurrency(student.totalDue)}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3">
                          {detailLine("Parent", student.parentName || "Parent")}
                          {detailLine("Mobile", student.parentMobile || "--")}
                          {detailLine("Class", classDisplay(student))}
                          {detailLine("Last payment", formatDate(student.lastPaymentDate))}
                        </dl>
                        <button className="btn-primary mt-4 w-full" type="button" onClick={() => void openStudent(student.id)}>
                          <Send size={16} /> View / Send Reminder
                        </button>
                      </article>
                    ))}
                  </div>

                  <article className="card hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[880px] text-left text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Admission / Roll</th>
                          <th className="px-4 py-3">Parent</th>
                          <th className="px-4 py-3">Mobile</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3 text-right">Due</th>
                          <th className="px-4 py-3">Last Payment</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClass.students.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-[#7d86a8]">No pending dues found.</td></tr>
                        ) : selectedClass.students.map((student) => (
                          <tr key={student.id} className={`border-t border-[#edf0f7] ${selectedStudentId === student.id ? "bg-[#eef0ff]" : ""}`}>
                            <td className="px-4 py-3 font-extrabold text-[#1f2136]">{student.studentName || "--"}</td>
                            <td className="px-4 py-3 text-[#7d86a8]">{student.admissionNumber || "--"}{student.rollNumber ? ` / ${student.rollNumber}` : ""}</td>
                            <td className="px-4 py-3">{student.parentName || "Parent"}</td>
                            <td className="px-4 py-3 text-[#7d86a8]">{student.parentMobile || "--"}</td>
                            <td className="px-4 py-3">{classDisplay(student)}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-[#ed515d]">{formatCurrency(student.totalDue)}</td>
                            <td className="px-4 py-3 text-[#7d86a8]">{formatDate(student.lastPaymentDate)}</td>
                            <td className="px-4 py-3 text-right">
                              <button className="btn-secondary" type="button" onClick={() => void openStudent(student.id)}>
                                <Send size={15} /> View / Send Reminder
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                </section>
              )}

              <section className="card overflow-hidden">
                {detailLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-[#7d86a8]">
                    <Loader2 size={18} className="animate-spin" /> Loading student reminder details...
                  </div>
                ) : !studentDetail ? (
                  <div className="p-8 text-center">
                    <UserRound size={28} className="mx-auto text-[#9aa4c4]" />
                    <p className="mt-3 text-sm font-semibold text-[#7d86a8]">Select a student to view fee-type dues and send a reminder.</p>
                  </div>
                ) : (
                  <div>
                    <div className="border-b border-[#edf0f7] p-4 md:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-extrabold text-[#1f2136]">{studentDetail.studentName}</h2>
                          <p className="mt-1 text-sm font-semibold text-[#7d86a8]">{studentDetail.parentName || "Parent"} · {studentDetail.parentMobile || "No mobile"} · Class {classDisplay(studentDetail)}</p>
                        </div>
                        <div className="rounded-xl bg-[#fff1f1] px-4 py-3 text-left lg:text-right">
                          <p className="text-xs font-bold uppercase text-[#d1485c]">Total Due</p>
                          <p className="text-2xl font-extrabold text-[#ed515d]">{formatCurrency(studentDetail.totalDue)}</p>
                        </div>
                      </div>
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {detailLine("Admission No.", studentDetail.admissionNumber)}
                        {detailLine("Roll No.", studentDetail.rollNumber)}
                        {detailLine("Parent", studentDetail.parentName || "Parent")}
                        {detailLine("Mobile", studentDetail.parentMobile || "--")}
                        {detailLine("Last payment", formatDate(studentDetail.lastPaymentDate))}
                      </dl>
                    </div>

                    <div className="grid gap-0 xl:grid-cols-[300px_minmax(0,1fr)]">
                      <aside className="border-b border-[#edf0f7] p-4 xl:border-b-0 xl:border-r">
                        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.02em] text-[#7d86a8]">Pending fee types</h3>
                        <div className="space-y-2">
                          {selectedFeeOptions.map((fee) => {
                            const active = selectedFee?.id === fee.id;
                            return (
                              <button
                                key={fee.id}
                                type="button"
                                onClick={() => setSelectedFeeId(fee.id)}
                                className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "border-[#3033a1] bg-[#eef0ff]" : "border-[#edf0f7] hover:bg-[#f7f8fd]"}`}
                              >
                                <span className="block truncate text-sm font-extrabold text-[#1f2136]">{fee.feeType}</span>
                                <span className="mt-1 block text-xs font-bold text-[#ed515d]">{formatCurrency(fee.dueAmount)} due</span>
                              </button>
                            );
                          })}
                        </div>
                      </aside>

                      <div className="p-4 md:p-5">
                        {selectedFee && (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-bold uppercase text-[#7d86a8]">Selected fee</p>
                                <h3 className="mt-1 text-2xl font-extrabold text-[#1f2136]">{selectedFee.feeType}</h3>
                              </div>
                              <button className="btn-primary" type="button" onClick={() => setSendSheetOpen(true)} disabled={!canSend || selectedFee.dueAmount <= 0}>
                                <Send size={16} /> Send Reminder
                              </button>
                            </div>

                            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                              <div className="rounded-xl bg-[#f7f8fd] p-4">
                                <dt className="text-xs font-bold uppercase text-[#7d86a8]">Fee Type</dt>
                                <dd className="mt-2 text-sm font-extrabold text-[#1f2136]">{selectedFee.feeType}</dd>
                              </div>
                              <div className="rounded-xl bg-[#f7f8fd] p-4">
                                <dt className="text-xs font-bold uppercase text-[#7d86a8]">Total Fee</dt>
                                <dd className="mt-2 text-lg font-extrabold text-[#1f2136]">{formatCurrency(selectedFee.totalFee)}</dd>
                              </div>
                              <div className="rounded-xl bg-[#e6f8ef] p-4">
                                <dt className="text-xs font-bold uppercase text-[#0f8d52]">Paid Amount</dt>
                                <dd className="mt-2 text-lg font-extrabold text-[#14a762]">{formatCurrency(selectedFee.paidAmount)}</dd>
                              </div>
                              <div className="rounded-xl bg-[#fff8ea] p-4">
                                <dt className="text-xs font-bold uppercase text-[#9f7116]">Discount</dt>
                                <dd className="mt-2 text-lg font-extrabold text-[#e29813]">{formatCurrency(selectedFee.concessionAmount)}</dd>
                              </div>
                              <div className="rounded-xl bg-[#fff1f1] p-4">
                                <dt className="text-xs font-bold uppercase text-[#d1485c]">Due Amount</dt>
                                <dd className="mt-2 text-lg font-extrabold text-[#ed515d]">{formatCurrency(selectedFee.dueAmount)}</dd>
                              </div>
                            </dl>
                            <div className="mt-4 rounded-xl border border-[#edf0f7] p-4">
                              <p className="text-xs font-bold uppercase text-[#7d86a8]">Due Date</p>
                              <p className="mt-1 text-sm font-extrabold text-[#1f2136]">{formatDate(selectedFee.dueDate)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </section>

      {sendSheetOpen && studentDetail && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="sheet-mobile w-full max-w-xl rounded-t-2xl border border-[#edf0f7] bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">Send Reminder</h2>
                <p className="mt-1 text-sm font-semibold text-[#7d86a8]">{selectedFee.feeType} · {formatCurrency(selectedFee.dueAmount)}</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setSendSheetOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#edf0f7] bg-[#f7f8fd] p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-[#1f2136]"><Phone size={16} /> {studentDetail.parentMobile || "Parent mobile number not available"}</p>
              {!hasMobile && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#ed515d]"><AlertCircle size={16} /> Parent mobile number not available</p>}
            </div>

            <div className="mt-4 max-h-[34vh] overflow-auto rounded-xl border border-[#edf0f7] bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase text-[#7d86a8]">Fixed message preview</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-6 text-[#303247]">{reminderMessage}</pre>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="btn-primary w-full bg-[#138a45] hover:bg-[#117d3f]"
                type="button"
                disabled={!hasMobile || sendingChannel !== null}
                onClick={() => void sendReminder("whatsapp")}
              >
                {sendingChannel === "whatsapp" ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Send via WhatsApp
              </button>
              <button
                className="btn-secondary w-full"
                type="button"
                disabled={!hasMobile || sendingChannel !== null}
                onClick={() => void sendReminder("google_messages")}
              >
                {sendingChannel === "google_messages" ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareText size={16} />} Send via Google Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
