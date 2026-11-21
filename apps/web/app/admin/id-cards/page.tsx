"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES, SECTION_OPTIONS } from "@/lib/studentClasses";
import { hasPermission } from "@sri-narayana/shared";
import { IdCard, Printer, RefreshCw, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Student = {
  id: string;
  studentName?: string;
  admissionNumber?: string;
  class?: string;
  className?: string;
  section?: string;
  rollNumber?: string;
  rollNo?: string;
  dateOfBirth?: string;
  dob?: string;
  bloodGroup?: string;
  fatherName?: string;
  motherName?: string;
  phone?: string;
  address?: string;
  photoUrl?: string;
  photoURL?: string;
};

type Staff = {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  subject: string;
  phone: string;
  photoUrl?: string;
};

type Design = { id: string; name: string; template: string; orientation: string };

const TEMPLATES = [
  { value: "classic", label: "Classic" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" }
];

function pick(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function IdCardsPage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const canViewStudents = hasPermission(role, "students.view");
  const canViewStaff = hasPermission(role, "staff.view");

  const [tab, setTab] = useState<"students" | "staff">("students");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [template, setTemplate] = useState("classic");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function loadStudents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (className) params.set("class", className);
      if (section) params.set("section", section);
      const res = await adminApiRequest<{ data?: Student[] }>(`/api/admin/students?${params}`);
      setStudents(res.data || []);
    } catch (e) { toast.error("Failed to load students", e instanceof AdminApiError ? e.message : undefined); }
    finally { setLoading(false); }
  }

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await adminApiRequest<{ teachers?: Record<string, unknown>[]; drivers?: Record<string, unknown>[]; office?: Record<string, unknown>[]; other?: Record<string, unknown>[] }>("/api/admin/staff/directory");
      const flatten = (rows: Record<string, unknown>[] | undefined, fallbackRole: string): Staff[] =>
        (rows || []).map((row) => ({
          id: String(row.id || ""),
          name: pick(row.fullName, pick(row.name, pick(row.displayName, pick(row.email, "Staff")))),
          employeeId: pick(row.employeeId, pick(row.employeeIdLower, "—")),
          role: pick(row.designation, pick(row.role, fallbackRole)),
          subject: pick(row.subject, pick(row.department, "")),
          phone: pick(row.phone, pick(row.mobile, "")),
          photoUrl: pick(row.photoUrl, pick(row.photoURL, ""))
        })).filter((row) => row.id);
      setStaff([...flatten(res.teachers, "Teacher"), ...flatten(res.drivers, "Driver"), ...flatten(res.office, "Office"), ...flatten(res.other, "Staff")]);
    } catch (e) { toast.error("Failed to load staff", e instanceof AdminApiError ? e.message : undefined); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (tab === "students" && canViewStudents) void loadStudents(); }, [tab, className, section]);
  useEffect(() => { if (tab === "staff" && canViewStaff) void loadStaff(); }, [tab]);
  useEffect(() => {
    adminApiRequest<{ items?: Design[] }>("/api/admin/masters/id-card-designs")
      .then((res) => {
        const rows = (res.items || []).filter((d) => d.template);
        setDesigns(rows);
        if (rows[0]) { setTemplate(rows[0].template); setOrientation(rows[0].orientation === "portrait" ? "portrait" : "landscape"); }
      })
      .catch(() => null);
  }, []);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => !q || `${s.studentName} ${s.admissionNumber} ${s.class || s.className} ${s.section}`.toLowerCase().includes(q));
  }, [students, search]);
  const visibleStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => !q || `${s.name} ${s.employeeId} ${s.role} ${s.subject}`.toLowerCase().includes(q));
  }, [staff, search]);

  const current = tab === "students" ? visibleStudents : visibleStaff;
  const allSelected = current.length > 0 && current.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) current.forEach((row) => next.delete(row.id));
      else current.forEach((row) => next.add(row.id));
      return next;
    });
  }
  function print() {
    if (selected.size === 0) return toast.error("Select at least one card to print");
    window.print();
  }

  if (!canViewStudents && !canViewStaff) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const selectedStudents = students.filter((s) => selected.has(s.id));
  const selectedStaff = staff.filter((s) => selected.has(s.id));
  const cardWidth = orientation === "landscape" ? "85.6mm" : "54mm";
  const cardHeight = orientation === "landscape" ? "54mm" : "85.6mm";

  return (
    <>
      <PageHeader title="ID Cards" description="Design, select and print student or staff identity cards." />
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .id-print-area, .id-print-area * { visibility: visible !important; }
          .id-print-area { position: absolute; left: 0; top: 0; width: 100%; display: flex !important; flex-wrap: wrap; gap: 4mm; }
          .id-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <section className="space-y-5 p-4 md:p-7">
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
            <button onClick={() => { setTab("students"); setSelected(new Set()); setSearch(""); }} className={`rounded-lg px-3 py-1.5 ${tab === "students" ? "bg-white text-[#1f2136] shadow-sm" : "text-stone-500"}`}>Students</button>
            <button onClick={() => { setTab("staff"); setSelected(new Set()); setSearch(""); }} className={`rounded-lg px-3 py-1.5 ${tab === "staff" ? "bg-white text-[#1f2136] shadow-sm" : "text-stone-500"}`}>Staff</button>
          </div>
          {tab === "students" && (
            <>
              <select className="field max-w-[180px]" value={className} onChange={(e) => { setClassName(e.target.value); setSelected(new Set()); }}>
                <option value="">All classes</option>
                {CLASS_SELECTOR_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select className="field max-w-[140px]" value={section} onChange={(e) => { setSection(e.target.value); setSelected(new Set()); }}>
                <option value="">All sections</option>
                {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input className="field max-w-[260px] pl-9" placeholder={tab === "students" ? "Search name / admission no." : "Search name / employee id"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="no-print card flex flex-wrap items-end gap-3 p-4">
          <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Design
            <select className="field mt-1 min-w-[190px]" value={template} onChange={(e) => setTemplate(e.target.value)}>
              {(designs.length ? designs.map((d) => ({ value: d.template, label: d.name })) : TEMPLATES).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Orientation
            <select className="field mt-1" value={orientation} onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
          <button className="btn-secondary" onClick={() => { setSelected(new Set()); setSearch(""); void (tab === "students" ? loadStudents() : loadStaff()); }}><RefreshCw size={15} /> Reload</button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all shown
          </label>
          <span className="text-sm text-stone-500">{selected.size} selected</span>
          <button className="btn-primary" onClick={print} disabled={selected.size === 0}><Printer size={16} /> Print cards</button>
        </div>

        <div className="no-print grid gap-5 xl:grid-cols-[320px_1fr]">
          <article className="card max-h-[540px] overflow-y-auto">
            <div className="sticky top-0 border-b border-stone-100 bg-white px-4 py-3"><h2 className="font-bold text-[#1f2136]">{tab === "students" ? "Students" : "Staff"} <span className="text-xs font-normal text-stone-500">({current.length})</span></h2></div>
            {loading ? <p className="p-4 text-sm text-stone-500">Loading…</p> : current.length === 0 ? <p className="p-4 text-sm text-stone-400">No records found.</p> : (
              <ul className="divide-y divide-stone-100">
                {tab === "students" ? visibleStudents.map((s) => (
                  <li key={s.id}><label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.studentName || "Student"}</span><span className="block text-xs text-stone-500">{s.admissionNumber || "—"} · {CLASS_LABELS[s.class || s.className || ""] || s.class || s.className || "—"}{s.section ? `-${s.section}` : ""}</span></span></label></li>
                )) : visibleStaff.map((s) => (
                  <li key={s.id}><label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block text-xs text-stone-500">{s.employeeId} · {s.role}{s.subject ? ` · ${s.subject}` : ""}</span></span></label></li>
                ))}
              </ul>
            )}
          </article>

          <article className="card p-5">
            <div className="mb-4 flex items-center gap-2"><IdCard size={18} className="text-[#3033a1]" /><h2 className="font-bold text-[#1f2136]">Live preview</h2></div>
            {selected.size === 0 ? <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">Select people on the left to preview their cards.</p> : (
              <div className="flex flex-wrap gap-4">
                {(tab === "students" ? selectedStudents.slice(0, 6).map((s) => ({ id: s.id, name: s.studentName || "Student", line1: `${CLASS_LABELS[s.class || s.className || ""] || s.class || s.className || ""}${s.section ? `-${s.section}` : ""}`, line2: s.admissionNumber || "", line3: s.fatherName || "", line4: s.phone || "", photo: s.photoUrl || s.photoURL })) : selectedStaff.slice(0, 6).map((s) => ({ id: s.id, name: s.name, line1: s.role, line2: s.employeeId, line3: s.subject || "", line4: s.phone || "", photo: s.photoUrl }))).map((person) => (
                  <IdCardView key={person.id} person={person} template={template} width={cardWidth} height={cardHeight} />
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-stone-500">Preview shows up to 6 cards. “Print cards” prints all selected cards at exact ID size.</p>
          </article>
        </div>

        <div className="id-print-area hidden flex-wrap gap-4">
          {selectedStudents.map((s) => (
            <IdCardView key={s.id} person={{ id: s.id, name: s.studentName || "Student", line1: `${CLASS_LABELS[s.class || s.className || ""] || s.class || s.className || ""}${s.section ? `-${s.section}` : ""}`, line2: `Adm ${s.admissionNumber || "—"}${s.rollNumber || s.rollNo ? ` · Roll ${s.rollNumber || s.rollNo}` : ""}`, line3: s.fatherName ? `S/o ${s.fatherName}` : "", line4: [s.bloodGroup, s.phone].filter(Boolean).join(" · "), photo: s.photoUrl || s.photoURL, dob: formatDate(s.dateOfBirth || s.dob || "") }} template={template} width={cardWidth} height={cardHeight} />
          ))}
          {selectedStaff.map((s) => (
            <IdCardView key={s.id} person={{ id: s.id, name: s.name, line1: s.role, line2: `ID ${s.employeeId}`, line3: s.subject, line4: s.phone, photo: s.photoUrl }} template={template} width={cardWidth} height={cardHeight} />
          ))}
        </div>
      </section>
    </>
  );
}

function IdCardView({ person, template, width, height }: {
  person: { id: string; name: string; line1: string; line2: string; line3: string; line4: string; photo?: string; dob?: string };
  template: string;
  width: string;
  height: string;
}) {
  const modern = template === "modern";
  const minimal = template === "minimal";
  return (
    <div className={`id-card relative overflow-hidden rounded-xl border ${modern ? "border-transparent bg-gradient-to-br from-[#1d2a57] to-[#3c4f9c] text-white" : minimal ? "border-stone-200 bg-white text-[#1f2136]" : "border-[#d9e0f5] bg-white text-[#1f2136]"}`} style={{ width, height }}>
      {!minimal && (
        <div className={modern ? "flex items-center gap-2 px-3 py-2" : "flex items-center gap-2 bg-[#1d2a57] px-3 py-2 text-white"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sri-narayana-high-school-logo.jpg" alt="" className="h-7 w-7 rounded-full bg-white object-contain" />
          <div className="leading-tight">
            <p className="text-[7px] font-black uppercase tracking-wider">Sri Narayana High School</p>
            <p className="text-[5px] font-semibold uppercase opacity-80">Ghanpur · Telangana</p>
          </div>
        </div>
      )}
      <div className="flex gap-2 px-3 py-1.5">
        <div className="shrink-0">
          {person.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo} alt="" className={`h-14 w-12 rounded object-cover ${minimal ? "border border-stone-200" : ""}`} />
          ) : (
            <div className={`grid h-14 w-12 place-items-center rounded text-sm font-black ${modern ? "bg-white/15 text-white" : "bg-[#eef0ff] text-[#3033a1]"}`}>{initials(person.name) || <Users size={16} />}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {minimal && <p className="text-[6px] font-black uppercase tracking-wider text-stone-500">Sri Narayana High School</p>}
          <p className="truncate text-[11px] font-black leading-tight">{person.name}</p>
          <p className={`text-[7px] font-bold ${modern ? "text-white/85" : "text-[#3033a1]"}`}>{person.line1}</p>
          <p className="mt-0.5 truncate text-[6px] font-semibold opacity-80">{person.line2}</p>
          {person.line3 && <p className="truncate text-[6px] opacity-80">{person.line3}</p>}
          {person.line4 && <p className="truncate text-[6px] opacity-80">{person.line4}</p>}
          {person.dob && <p className="text-[6px] opacity-80">DOB {person.dob}</p>}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1 text-[5px] font-bold uppercase tracking-wide ${modern ? "bg-black/20 text-white/80" : minimal ? "border-t border-stone-100 text-stone-500" : "bg-[#eef0ff] text-[#3033a1]"}`}>
        <span>Student Identity Card</span>
        <span>2026–27</span>
      </div>
    </div>
  );
}
