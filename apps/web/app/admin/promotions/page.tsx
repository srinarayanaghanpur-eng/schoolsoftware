"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, type AcademicYear } from "@sri-narayana/shared";
import {
  AlertCircle, ArrowRight, ArrowUpDown, Ban, CheckCircle2, ChevronDown,
  Clock, GraduationCap, History, ListRestart, Loader2, Plus, RotateCcw,
  Search, SlidersHorizontal, Users, X
} from "lucide-react";
import { useMemo, useState, useEffect, type FormEvent } from "react";

const CLASS_OPTIONS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];
const CLASS_LABELS: Record<string, string> = {
  Nur: "Nursery", LKG: "L.K.G", UKG: "U.K.G",
  "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
  "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X"
};

const CLASS_ORDER = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function nextClass(current: string): string {
  const idx = CLASS_ORDER.indexOf(current);
  if (idx === -1 || idx >= CLASS_ORDER.length - 1) return current;
  return CLASS_ORDER[idx + 1];
}

type Tab = "promote" | "detain" | "section" | "history";
type PromotionType = "promote" | "detain" | "section_change";

type Student = {
  id: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  fatherName?: string;
  totalFeesDue?: number;
  totalFeesPaid?: number;
  feeStatus?: string;
};

type PromotionRecord = {
  id?: string;
  promotionType: PromotionType;
  academicYearId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  fromClass: string;
  fromSection: string;
  toClass?: string;
  toSection?: string;
  feeBalanceCarriedForward: number;
  notes?: string;
  status: string;
  approvalId?: string;
  createdBy: string;
  createdAt: string;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-[#e6f8ef] text-[#0f8d52]",
    pending: "bg-[#fff7e5] text-[#b8860b]",
    approved: "bg-[#e6f8ef] text-[#0f8d52]",
    rejected: "bg-[#ffebed] text-[#c83f4d]"
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] || "bg-[#eef0f7] text-[#7d86a8]"}`}>
      {status === "completed" && <CheckCircle2 size={12} />}
      {status === "pending" && <Clock size={12} />}
      {status}
    </span>
  );
}

function AccessNotice() {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <AlertCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Your role cannot view promotions.</p>
        </div>
      </div>
    </section>
  );
}

export default function PromotionsPage() {
  const { role } = useAdminSession();
  const { years, activeYear } = useAcademicYears();

  const canView = Boolean(role && hasPermission(role, "promotions.view"));
  const canCreate = Boolean(canView && (role === "admin" || role === "principal" || role === "super_admin"));

  const [tab, setTab] = useState<Tab>("promote");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const [fromClass, setFromClass] = useState("");
  const [fromSection, setFromSection] = useState("");
  const [toClass, setToClass] = useState("");
  const [toSection, setToSection] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [feeCarryForward, setFeeCarryForward] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [notes, setNotes] = useState("");

  const [history, setHistory] = useState<PromotionRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState("");

  useEffect(() => {
    if (activeYear?.id) setTargetYearId(activeYear.id);
  }, [activeYear]);

  useEffect(() => {
    if (canView) fetchStudents();
  }, [canView]);

  useEffect(() => {
    let filtered = students;
    if (fromClass) filtered = filtered.filter((s) => s.class === fromClass);
    if (fromSection) filtered = filtered.filter((s) => s.section === fromSection);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s) =>
        s.studentName.toLowerCase().includes(term) || s.admissionNumber.includes(term)
      );
    }
    setFilteredStudents(filtered);
  }, [students, fromClass, fromSection, searchTerm]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromClass) params.set("class", fromClass);
      const res = await fetch(`/api/admin/students?${params}`);
      const data = await res.json();
      if (data.success) setStudents(data.data);
    } catch {
      setError("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (historyFilter) params.set("class", historyFilter);
      if (activeYear?.id) params.set("academicYearId", activeYear.id);
      const data = await adminApiRequest<{ ok: boolean; records: PromotionRecord[] }>(`/api/admin/promotions/history?${params}`);
      if (data.ok) setHistory(data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch promotion history");
    } finally {
      setLoading(false);
    }
  };

  const resolvedToClass = tab === "promote" ? (toClass || (fromClass ? nextClass(fromClass) : "")) : tab === "section" ? fromClass : fromClass;
  const resolvedToSection = tab === "section" ? (toSection || fromSection || "A") : tab === "detain" ? "" : (toSection || "");

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudentIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
      setSelectAll(true);
    }
  };

  const resetForm = () => {
    setSelectedStudentIds(new Set());
    setSelectAll(false);
    setToClass("");
    setToSection("");
    setFeeCarryForward(false);
    setRequireApproval(false);
    setNotes("");
    setError(null);
    setSuccess(null);
  };

  const handlePromoteAllClassWise = async () => {
    if (!fromClass) { setError("Select a source class first."); return; }
    if (!targetYearId) { setError("Select a target academic year."); return; }
    if (filteredStudents.length === 0) { setError("No students found for the selected class."); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const studentIds = filteredStudents.map((s) => s.id);
      const data = await adminApiRequest<{ ok: boolean; count: number }>("/api/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          promotionType: tab as PromotionType,
          academicYearId: targetYearId,
          studentIds,
          fromClass,
          fromSection,
          toClass: resolvedToClass,
          toSection: resolvedToSection,
          feeBalanceCarryForward: feeCarryForward,
          requireApproval,
          notes: notes || `Class-wise ${tab} from ${fromClass}`
        })
      });
      if (data.ok) {
        setSuccess(`Successfully ${tab === "detain" ? "processed" : "promoted"} ${data.count} student(s).`);
        resetForm();
        fetchStudents();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteSelected = async () => {
    if (selectedStudentIds.size === 0) { setError("Select at least one student."); return; }
    if (!targetYearId) { setError("Select a target academic year."); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await adminApiRequest<{ ok: boolean; count: number }>("/api/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          promotionType: tab as PromotionType,
          academicYearId: targetYearId,
          studentIds: Array.from(selectedStudentIds),
          fromClass,
          fromSection,
          toClass: resolvedToClass,
          toSection: resolvedToSection,
          feeBalanceCarryForward: feeCarryForward,
          requireApproval,
          notes: notes || `Selected ${tab} from ${fromClass}`
        })
      });
      if (data.ok) {
        setSuccess(`Successfully processed ${data.count} student(s).`);
        resetForm();
        fetchStudents();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "history" && canView) fetchHistory();
  }, [tab, historyFilter, canView]);

  if (!canView) {
    return (
      <>
        <PageHeader title="Promotion" description="Manage student class promotions, section changes, and holds." />
        <AccessNotice />
      </>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof GraduationCap }[] = [
    { key: "promote", label: "Promote", icon: GraduationCap },
    { key: "detain", label: "Detain / Hold", icon: Ban },
    { key: "section", label: "Section Change", icon: ArrowUpDown },
    { key: "history", label: "History", icon: History }
  ];

  return (
    <>
      <PageHeader
        title="Promotion"
        description={
          activeYear
            ? `Managing promotions for ${activeYear.name}`
            : "Set an active academic year to begin promotions"
        }
      />

      <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-7">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); resetForm(); }}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#2d3094] text-white shadow-sm"
                  : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>
        )}
        {success && (
          <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{success}</div>
        )}

        {tab !== "history" && (
          <div className="card overflow-hidden p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#1f2136]">
                  {tab === "promote" && "Promote Students"}
                  {tab === "detain" && "Detain / Hold Students"}
                  {tab === "section" && "Change Section"}
                </h3>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                  {tab === "promote" && "Move students to the next class or a selected class."}
                  {tab === "detain" && "Retain students in their current class."}
                  {tab === "section" && "Change section within the same class."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-1 text-sm font-semibold text-[#303247]">
                <span>From Class</span>
                <select className="field" value={fromClass} onChange={(e) => { setFromClass(e.target.value); setSelectedStudentIds(new Set()); setSelectAll(false); }}>
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{CLASS_LABELS[c] ?? c}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#303247]">
                <span>From Section</span>
                <select className="field" value={fromSection} onChange={(e) => setFromSection(e.target.value)}>
                  <option value="">All sections</option>
                  {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {tab === "promote" && (
                <>
                  <label className="space-y-1 text-sm font-semibold text-[#303247]">
                    <span>To Class</span>
                    <select className="field" value={toClass} onChange={(e) => setToClass(e.target.value)}>
                      <option value="">Auto ({fromClass ? nextClass(fromClass) : "—"})</option>
                      {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{CLASS_LABELS[c] ?? c}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-[#303247]">
                    <span>To Section</span>
                    <select className="field" value={toSection} onChange={(e) => setToSection(e.target.value)}>
                      <option value="">Keep current</option>
                      {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </>
              )}
              {tab === "section" && (
                <>
                  <label className="space-y-1 text-sm font-semibold text-[#303247]">
                    <span>New Section</span>
                    <select className="field" value={toSection} onChange={(e) => setToSection(e.target.value)} required>
                      <option value="">Select section</option>
                      {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <div />
                </>
              )}
              {tab === "detain" && (
                <>
                  <div className="text-sm font-medium text-[#7d86a8] pt-6">Students will remain in their current class.</div>
                  <div />
                </>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold text-[#303247]">
                <span>Target Academic Year</span>
                <select className="field" value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)}>
                  {years.length === 0 && <option value="">No years available</option>}
                  {years.map((y: AcademicYear) => (
                    <option key={y.id} value={y.id ?? ""}>{y.name}{y.isActive ? " (Active)" : ""}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#303247]">
                <span>Notes</span>
                <input className="field" placeholder="Reason for promotion..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#303247] cursor-pointer">
                <input type="checkbox" className="h-5 w-5 rounded border-[#dfe3f1] accent-[#3033a1]" checked={feeCarryForward} onChange={(e) => setFeeCarryForward(e.target.checked)} />
                Carry forward fee balance
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#303247] cursor-pointer">
                <input type="checkbox" className="h-5 w-5 rounded border-[#dfe3f1] accent-[#3033a1]" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
                Require approval
              </label>
            </div>

            {fromClass && (
              <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8490b9]" />
                    <input
                      className="field pl-9"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#7d86a8]">
                    <Users size={16} />
                    {filteredStudents.length} student(s)
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-[#7d86a8]">
                    <Loader2 size={18} className="animate-spin" />
                    Loading students...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-sm font-medium text-[#7d86a8]">
                    {students.length === 0 ? "No students found. Select a class to load students." : "No students match the current filters."}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#edf0f7]">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                        <tr>
                          <th className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[#dfe3f1] accent-[#3033a1]"
                              checked={selectAll && filteredStudents.length > 0}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Adm No.</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Name</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Class</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Father</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Fee Due</th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">
                            {tab === "promote" && "→ " + (resolvedToClass || "?")}
                            {tab === "detain" && "Stay"}
                            {tab === "section" && "→ " + (resolvedToSection || "?")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="border-b border-[#edf0f7] last:border-b-0 hover:bg-[#fafbff]">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[#dfe3f1] accent-[#3033a1]"
                                checked={selectedStudentIds.has(student.id)}
                                onChange={() => toggleStudent(student.id)}
                              />
                            </td>
                            <td className="px-4 py-3 font-bold text-[#303247]">{student.admissionNumber}</td>
                            <td className="px-4 py-3 font-semibold text-[#303247]">{student.studentName}</td>
                            <td className="px-4 py-3 font-medium text-[#7d86a8]">{student.class}-{student.section}</td>
                            <td className="px-4 py-3 font-medium text-[#7d86a8]">{student.fatherName || "--"}</td>
                            <td className="px-4 py-3 font-medium text-[#7d86a8]">
                              {student.totalFeesDue ? `₹${student.totalFeesDue.toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#3033a1]">
                                {tab === "promote" && <><ArrowRight size={14} /> {resolvedToClass || "?"}{resolvedToSection ? "-" + resolvedToSection : ""}</>}
                                {tab === "detain" && <><Ban size={14} /> Same class</>}
                                {tab === "section" && <><ArrowUpDown size={14} /> {resolvedToSection || "?"}</>}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handlePromoteAllClassWise}
                    disabled={loading || !fromClass || filteredStudents.length === 0}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ListRestart size={16} />}
                    {tab === "promote" && ` Promote All (${filteredStudents.length})`}
                    {tab === "detain" && ` Detain All (${filteredStudents.length})`}
                    {tab === "section" && ` Change All (${filteredStudents.length})`}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handlePromoteSelected}
                    disabled={loading || selectedStudentIds.size === 0}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                    Process Selected ({selectedStudentIds.size})
                  </button>
                  <button type="button" className="btn-secondary" onClick={resetForm}>
                    <RotateCcw size={16} /> Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="card overflow-hidden p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#1f2136]">Promotion History</h3>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">Past promotions, detentions, and section changes.</p>
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[#8490b9]" />
                <select className="field max-w-[160px]" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                  <option value="">All classes</option>
                  {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{CLASS_LABELS[c] ?? c}</option>)}
                </select>
                <button type="button" className="btn-secondary" onClick={fetchHistory}>
                  <RotateCcw size={15} /> Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-[#7d86a8]">
                <Loader2 size={18} className="animate-spin" /> Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef0ff] text-[#3033a1]">
                  <History size={26} />
                </span>
                <h2 className="mt-4 text-lg font-extrabold text-[#1f2136]">No promotion records yet</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">Promotions will appear here once processed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Date</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Student</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">From</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">To</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Type</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Fee CF</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((rec) => (
                      <tr key={rec.id} className="border-b border-[#edf0f7] last:border-b-0 hover:bg-[#fafbff]">
                        <td className="px-4 py-3 text-xs font-medium text-[#7d86a8]">{formatDate(rec.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#303247]">{rec.studentName}</p>
                          <p className="text-xs text-[#7d86a8]">#{rec.admissionNumber}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#7d86a8]">{rec.fromClass}-{rec.fromSection}</td>
                        <td className="px-4 py-3 font-medium text-[#7d86a8]">
                          {rec.toClass ? `${rec.toClass}${rec.toSection ? "-" + rec.toSection : ""}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                            rec.promotionType === "promote" ? "bg-[#e6f8ef] text-[#0f8d52]" :
                            rec.promotionType === "detain" ? "bg-[#fff7e5] text-[#b8860b]" :
                            "bg-[#eef6ff] text-[#3069a1]"
                          }`}>
                            {rec.promotionType === "promote" && <GraduationCap size={12} />}
                            {rec.promotionType === "detain" && <Ban size={12} />}
                            {rec.promotionType === "section_change" && <ArrowUpDown size={12} />}
                            {rec.promotionType === "promote" ? "Promoted" : rec.promotionType === "detain" ? "Detained" : "Section"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#7d86a8]">
                          {rec.feeBalanceCarriedForward > 0 ? `₹${rec.feeBalanceCarriedForward.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
