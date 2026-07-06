"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { hasPermission } from "@sri-narayana/shared";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { PageHeader } from "@/components/PageHeader";
import {
  Send, Copy, ClipboardCopy, FileSpreadsheet, CheckCheck, X, MessageSquare,
  Search, ChevronDown, Phone, User, Users, School, BookOpen
} from "lucide-react";

type StudentRecord = {
  id: string;
  name: string;
  className: string;
  section: string;
  fatherName?: string;
  motherName?: string;
  phone?: string;
  alternatePhone?: string;
};

type SmsTemplate = {
  id: string;
  name: string;
  body: string;
  category: string;
};

const CLASS_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SECTION_OPTIONS = ["A", "B", "C"];
const PLACEHOLDERS = ["{{studentName}}", "{{parentName}}", "{{class}}", "{{section}}", "{{schoolName}}", "{{amountDue}}", "{{dueDate}}"];
const CATEGORIES = ["Fee Reminder", "Attendance Alert", "Holiday Notice", "Exam Notification", "Parent Meeting", "Transport Notice", "Admission Follow-up", "Birthday Wishes", "General Announcement", "Emergency Notice"];

function renderPreview(template: string, student: StudentRecord): string {
  return template
    .replace(/\{\{studentName\}\}/g, student.name)
    .replace(/\{\{parentName\}\}/g, student.fatherName || student.motherName || "Parent")
    .replace(/\{\{class\}\}/g, student.className)
    .replace(/\{\{section\}\}/g, student.section)
    .replace(/\{\{schoolName\}\}/g, "Sri Narayana High School");
}

function countSegments(text: string): number {
  if (!text) return 0;
  const gsm7bitChars = /^[A-Za-z0-9 \r\n.,!?@#$%&'*+\-/=\[\]^_`{|}~£¥¤§¿ÄÅÆÇÉÑÖØÜßàäåæçèéìñòöøùü"():;<>]+$/;
  const maxPerSegment = gsm7bitChars.test(text) ? 160 : 70;
  return Math.ceil(text.length / maxPerSegment);
}

export default function SmsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();

  const canCompose = Boolean(role && hasPermission(role, "sms.compose"));
  const canCopy = Boolean(role && hasPermission(role, "sms.copy"));
  const canExport = Boolean(role && hasPermission(role, "sms.export"));
  const canMarkSent = Boolean(role && hasPermission(role, "sms.mark_sent"));
  const canManageTemplates = Boolean(role && hasPermission(role, "sms.templates"));
  const canView = Boolean(role && hasPermission(role, "sms.view"));

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [composedMessage, setComposedMessage] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const segmentCount = useMemo(() => countSegments(composedMessage), [composedMessage]);

  const loadStudents = useCallback(async () => {
    if (!selectedYear?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("academicYearId", selectedYear.id);
      params.set("pageSize", "500");
      const result = await adminApiRequest<{ success?: boolean; data?: StudentRecord[] }>(
        `/api/admin/students?${params.toString()}`
      );
      setStudents(result.data ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load students");
    } finally {
      setLoading(false);
    }
  }, [selectedYear?.id]);

  const loadTemplates = useCallback(async () => {
    try {
      const result = await adminApiRequest<{ ok: boolean; templates: SmsTemplate[] }>("/api/admin/sms/templates");
      setTemplates(result.templates ?? []);
    } catch {
      // templates unavailable
    }
  }, []);

  useEffect(() => {
    if (selectedYear?.id) void loadStudents();
  }, [loadStudents, selectedYear?.id]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let list = students;
    if (classFilter) list = list.filter((s) => s.className === classFilter);
    if (sectionFilter) list = list.filter((s) => s.section === sectionFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.fatherName?.toLowerCase().includes(q) || s.phone?.includes(q));
    }
    setFilteredStudents(list);
  }, [students, classFilter, sectionFilter, searchTerm]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds]
  );

  const applyTemplate = (template: SmsTemplate) => {
    setComposedMessage(template.body);
    setActiveTemplateId(template.id);
    setShowTemplatePicker(false);
  };

  const insertPlaceholder = (placeholder: string) => {
    setComposedMessage((prev) => prev + placeholder);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(composedMessage);
      setMessage("Message copied to clipboard");
    } catch {
      setError("Failed to copy message");
    }
  };

  const copySingleNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setMessage(`Number ${phone} copied`);
    } catch {
      setError("Failed to copy number");
    }
  };

  const copySelectedNumbers = async () => {
    const numbers = selectedStudents
      .map((s) => s.phone)
      .filter(Boolean)
      .join(", ");
    if (!numbers) { setError("No numbers selected"); return; }
    try {
      await navigator.clipboard.writeText(numbers);
      setMessage(`Copied ${selectedStudents.length} number(s)`);
    } catch {
      setError("Failed to copy numbers");
    }
  };

  const copyAllNumbers = async () => {
    const numbers = filteredStudents
      .map((s) => s.phone)
      .filter(Boolean)
      .join(", ");
    if (!numbers) { setError("No numbers available"); return; }
    try {
      await navigator.clipboard.writeText(numbers);
      setMessage(`Copied ${filteredStudents.length} number(s)`);
    } catch {
      setError("Failed to copy numbers");
    }
  };

  const exportCsv = () => {
    const rows = [["Name", "Parent", "Class", "Section", "Phone", "Alt Phone"]];
    const source = selectedIds.size > 0 ? selectedStudents : filteredStudents;
    source.forEach((s) => {
      rows.push([s.name, s.fatherName || s.motherName || "", s.className, s.section, s.phone || "", s.alternatePhone || ""]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sms-recipients-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${source.length} recipient(s)`);
  };

  const markAsSent = async () => {
    if (!canMarkSent) return;
    try {
      await adminApiRequest("/api/admin/sms/history", {
        method: "POST",
        body: JSON.stringify({
          recipientCount: selectedIds.size || filteredStudents.length,
          templateUsed: templates.find((t) => t.id === activeTemplateId)?.name || "",
          messagePreview: composedMessage.slice(0, 200),
          sentByName: "User"
        })
      });
      setMessage("Logged as sent");
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to log");
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setComposedMessage("");
    setActiveTemplateId("");
  };

  const openSmsLink = (phone: string) => {
    const encoded = encodeURIComponent(phone);
    const body = encodeURIComponent(composedMessage);
    window.open(`sms:${encoded}?body=${body}`, "_blank");
  };

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="Manual SMS"
        description="Select recipients, compose a message, and send via Google Messages for Web."
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[#ffebed] px-4 py-3 text-sm font-bold text-[#d84d5b]">
            <X size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-lg bg-[#e8f5e9] px-4 py-3 text-sm font-bold text-[#2e7d32]">
            <CheckCheck size={16} /> {message}
            <button onClick={() => setMessage(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input h-10 min-w-[140px] rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All Classes</option>
            {CLASS_OPTIONS.map((c) => (<option key={c} value={c}>Class {c}</option>))}
          </select>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="input h-10 min-w-[120px] rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All Sections</option>
            {SECTION_OPTIONS.map((s) => (<option key={s} value={s}>Section {s}</option>))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, parent, phone..." className="input h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm" />
          </div>
          <button onClick={() => void loadStudents()} disabled={loading} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
            <Search size={16} /> Refresh
          </button>
        </div>

        <div className="card overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <input type="checkbox" checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length} onChange={toggleAll} className="h-4 w-4 rounded border-border" />
            <span className="text-sm font-bold text-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${filteredStudents.length} selected`
                : `${filteredStudents.length} student(s)`}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading..." : ""}</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {filteredStudents.length === 0 && !loading && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-sm text-muted-foreground">
                <Users size={32} className="opacity-30" />
                No students found
              </div>
            )}
            {filteredStudents.map((student) => {
              const checked = selectedIds.has(student.id);
              const phone = student.phone || "";
              return (
                <div key={student.id} className={`flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-sm transition ${checked ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)} className="h-4 w-4 rounded border-border" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">
                      <User size={14} className="mr-1 inline-block text-muted-foreground" />
                      {student.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {student.fatherName || student.motherName || "—"} · Class {student.className}-{student.section}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {phone && (
                      <>
                        <span className="hidden text-xs text-muted-foreground md:inline">{phone}</span>
                        {canCopy && (
                          <button onClick={() => copySingleNumber(phone)} title="Copy number" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground">
                            <Copy size={14} />
                          </button>
                        )}
                        <button onClick={() => openSmsLink(phone)} title="Send SMS" className="grid h-8 w-8 place-items-center rounded-lg text-primary transition hover:bg-primary/10">
                          <MessageSquare size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-foreground">Message Composer</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{composedMessage.length} chars</span>
                <span className="text-xs font-bold text-primary">{segmentCount} segment(s)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setShowTemplatePicker(!showTemplatePicker)} className="btn-secondary h-8 rounded-lg px-3 text-xs font-bold">
                <ChevronDown size={14} /> Templates
              </button>
              {PLACEHOLDERS.map((p) => (
                <button key={p} onClick={() => insertPlaceholder(p)} className="rounded-md bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  {p}
                </button>
              ))}
            </div>

            {showTemplatePicker && (
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border bg-card p-2">
                {templates.length === 0 && <p className="p-2 text-xs text-muted-foreground">No templates yet.</p>}
                {templates.map((t) => (
                  <button key={t.id} onClick={() => applyTemplate(t)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent ${activeTemplateId === t.id ? "bg-primary/10 font-bold" : ""}`}>
                    <span className="block text-xs text-muted-foreground">{t.category}</span>
                    <span className="block truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={composedMessage}
              onChange={(e) => setComposedMessage(e.target.value)}
              placeholder="Type your SMS message here... Use {{placeholders}} above."
              rows={5}
              maxLength={918}
              className="input w-full rounded-lg border border-border bg-card p-3 text-sm resize-none focus:ring-2 focus:ring-primary/30"
            />

            {selectedStudents.length > 0 && composedMessage && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-1 text-xs font-bold text-muted-foreground">Preview (first recipient)</p>
                <p className="whitespace-pre-wrap break-words rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-sm">
                  {renderPreview(composedMessage, selectedStudents[0])}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {canCompose && composedMessage && selectedStudents.length > 0 && (
                <button onClick={() => openSmsLink(selectedStudents[0].phone || "")} className="btn-primary h-10 rounded-lg px-4 text-sm font-bold">
                  <Send size={16} /> Send SMS
                </button>
              )}
              {canCopy && composedMessage && (
                <button onClick={copyMessage} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
                  <ClipboardCopy size={16} /> Copy Message
                </button>
              )}
              {canCopy && selectedIds.size > 0 && (
                <button onClick={copySelectedNumbers} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
                  <Copy size={16} /> Copy Selected ({selectedIds.size})
                </button>
              )}
              {canCopy && (
                <button onClick={copyAllNumbers} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
                  <Copy size={16} /> Copy All
                </button>
              )}
              {canExport && (
                <button onClick={exportCsv} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              )}
              {canMarkSent && composedMessage && (
                <button onClick={markAsSent} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold text-green-700">
                  <CheckCheck size={16} /> Mark as Sent
                </button>
              )}
              <button onClick={clearSelection} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold text-[#d84d5b]">
                <X size={16} /> Clear
              </button>
            </div>
          </div>

          <div className="card space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-extrabold text-foreground">Selected Recipients ({selectedStudents.length})</h3>
            {selectedStudents.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                <Users size={32} className="opacity-30" />
                Select students from the list
              </div>
            )}
            <div className="max-h-[360px] space-y-1 overflow-y-auto">
              {selectedStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.fatherName || s.motherName || "—"} · {s.phone || "No phone"}
                    </span>
                  </div>
                  {(s.phone ?? "") && (
                    <button onClick={() => openSmsLink(s.phone || "")} title="Send SMS" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-primary transition hover:bg-primary/10">
                      <MessageSquare size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
