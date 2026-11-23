"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES, SECTION_OPTIONS } from "@/lib/studentClasses";
import { hasPermission } from "@sri-narayana/shared";
import { IdCard, Printer, RefreshCw, Search } from "lucide-react";
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
  route?: string;
  busRoute?: string;
  transportRoute?: string;
  transportRouteName?: string;
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
  bloodGroup?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  photoUrl?: string;
};

type CardPerson = {
  id: string;
  kind: "student" | "staff";
  name: string;
  father?: string;
  className?: string;
  admissionNumber?: string;
  dob?: string;
  mobile?: string;
  address?: string;
  bloodGroup?: string;
  route?: string;
  photo?: string;
  employeeId?: string;
  designation?: string;
  emergencyContact?: string;
};

const AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#dbe4f5"/><circle cx="50" cy="38" r="18" fill="#9fb2d8"/><path d="M14 100c2-26 20-38 36-38s34 12 36 38z" fill="#9fb2d8"/></svg>');

function pick(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function studentCard(student: Student): CardPerson {
  return {
    id: `student:${student.id}`,
    kind: "student",
    name: pick(student.studentName, "Student"),
    father: pick(student.fatherName),
    className: CLASS_LABELS[student.class || student.className || ""] || pick(student.class || student.className),
    admissionNumber: pick(student.admissionNumber),
    dob: formatDate(pick(student.dateOfBirth || student.dob)),
    mobile: pick(student.phone),
    address: pick(student.address),
    bloodGroup: pick(student.bloodGroup),
    route: pick(student.route || student.busRoute || student.transportRoute || student.transportRouteName),
    photo: pick(student.photoUrl || student.photoURL)
  };
}

function staffCard(staff: Staff): CardPerson {
  return {
    id: `staff:${staff.id}`,
    kind: "staff",
    name: pick(staff.name, "Staff"),
    employeeId: pick(staff.employeeId),
    designation: pick(staff.role),
    mobile: pick(staff.phone),
    bloodGroup: pick(staff.bloodGroup),
    emergencyContact: pick(staff.emergencyContact || staff.emergencyPhone),
    photo: pick(staff.photoUrl)
  };
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [printRequest, setPrintRequest] = useState<{ people: CardPerson[]; token: number } | null>(null);

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
          bloodGroup: pick(row.bloodGroup),
          emergencyContact: pick(row.emergencyContact, pick(row.emergencyPhone)),
          photoUrl: pick(row.photoUrl, pick(row.photoURL, ""))
        })).filter((row) => row.id);
      setStaff([...flatten(res.teachers, "Teacher"), ...flatten(res.drivers, "Driver"), ...flatten(res.office, "Office"), ...flatten(res.other, "Staff")]);
    } catch (e) { toast.error("Failed to load staff", e instanceof AdminApiError ? e.message : undefined); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (tab === "students" && canViewStudents) void loadStudents(); }, [tab, className, section]);
  useEffect(() => { if (tab === "staff" && canViewStaff) void loadStaff(); }, [tab]);

  useEffect(() => {
    if (!printRequest) return;
    const timer = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(timer);
  }, [printRequest]);

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

  function printPeople(people: CardPerson[]) {
    if (people.length === 0) { toast.error("Select at least one card to print"); return; }
    setPrintRequest({ people, token: Date.now() });
  }

  function printSelected() {
    const people = tab === "students"
      ? students.filter((s) => selected.has(s.id)).map(studentCard)
      : staff.filter((s) => selected.has(s.id)).map(staffCard);
    printPeople(people);
  }

  if (!canViewStudents && !canViewStaff) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const selectedStudents = students.filter((s) => selected.has(s.id));
  const selectedStaff = staff.filter((s) => selected.has(s.id));
  const previewPeople = (tab === "students" ? selectedStudents.map(studentCard) : selectedStaff.map(staffCard)).slice(0, 3);

  return (
    <>
      <PageHeader title="ID Cards" description="Print CR80 (54 × 86 mm) student and staff identity cards." />
      <style>{`
        .np-id-card { position: relative; width: 54mm; height: 86mm; background: #fff; overflow: hidden; border-radius: 3mm; font-family: Arial, Helvetica, sans-serif; box-shadow: 0 2px 8px #0004; }
        .np-id-card svg.np-bg { position: absolute; left: 0; top: 0; width: 54mm; height: 86mm; }
        .np-id-card > *:not(svg) { position: absolute; }
        .np-lg { width: 10mm; height: 10mm; object-fit: contain; }
        .np-sn { color: #fff; font-weight: 800; font-size: 6.6pt; line-height: 1.1; letter-spacing: .1pt; }
        .np-ad { font-size: 4.6pt; color: #fff; }
        .np-ph { background: #e5e7eb center/cover no-repeat; }
        .np-rows { font-size: 5.6pt; line-height: 1.25; }
        .np-rows > div { display: flex; gap: 1mm; }
        .np-rows b { flex: 0 0 16mm; }
        .np-rows span { flex: 1; font-weight: 700; color: #0b2a5b; }
        .np-s1 .np-lg { left: 2mm; top: 2mm; background: #fff; border-radius: 50%; padding: .9mm; }
        .np-s1 .np-sn { left: 13.5mm; top: 3.2mm; width: 38mm; }
        .np-s1 .np-ad { left: 13.5mm; top: 9mm; width: 38mm; }
        .np-s1 .np-ph { left: 14.5mm; top: 13mm; width: 25mm; height: 25mm; border-radius: 50%; border: 1mm solid #fff; box-shadow: 0 0 0 .4mm #1f3490; }
        .np-s1 .np-nm { left: 0; right: 0; top: 39.3mm; text-align: center; font: 700 9pt Georgia, serif; color: #1f3490; }
        .np-s1 .np-rows { left: 3mm; right: 3mm; top: 46mm; font-size: 6.6pt; line-height: 1.5; background: #fff; border: .3mm solid #c9d2ee; border-radius: 2mm; padding: 1.5mm 2mm; box-shadow: 0 .4mm 1mm #0002; }
        .np-t1 .np-lg { left: 2mm; top: 2mm; }
        .np-t1 .np-sn { left: 13.5mm; top: 3.4mm; width: 38mm; color: #1f3490; }
        .np-t1 .np-ad { left: 13.5mm; top: 9mm; width: 38mm; color: #333; }
        .np-t1 .np-ph { left: 12mm; top: 13mm; width: 30mm; height: 30mm; border-radius: 4mm; border: 1mm solid #fff; box-shadow: 0 0 0 .4mm #ccc; }
        .np-t1 .np-nm { left: 0; right: 0; top: 44mm; text-align: center; font: 700 8.5pt Arial; color: #1f3490; }
        .np-t1 .np-rows { left: 6mm; right: 4mm; top: 50mm; font-size: 5.8pt; }
        .np-t1 .np-rows b { flex: 0 0 17mm; }
        .np-t1 .np-ct { left: 5mm; right: 4mm; top: 71mm; color: #fff; }
        .np-t1 .np-ct b { font-size: 6.5pt; display: block; margin-bottom: .6mm; }
        .np-t1 .np-ct p { margin: 0; font-size: 4.6pt; line-height: 1.3; }
        .np-bk .np-lg { left: 21mm; top: 3mm; width: 12mm; height: 12mm; }
        .np-bk .np-sn { left: 2mm; right: 2mm; top: 16.5mm; text-align: center; font-size: 7pt; }
        .np-bk .np-ad { left: 2mm; right: 2mm; top: 22.5mm; text-align: center; font-size: 4.8pt; }
        .np-bk .np-info { left: 5mm; right: 5mm; top: 38mm; font-size: 6.8pt; line-height: 1.8; color: #0b2a5b; }
        .np-bk .np-info b { color: #000; }
        .np-bk .np-rt { left: 4mm; right: 4mm; top: 60mm; text-align: center; font-size: 5pt; color: #333; }
        .np-bk .np-pr { right: 5mm; bottom: 7mm; font-size: 5pt; border-top: .3mm solid #000; padding-top: .6mm; width: 20mm; text-align: center; color: #fff; }
        .np-bk .np-rec { left: 0; right: 0; bottom: 1.6mm; text-align: center; font-size: 4.5pt; color: #fff; font-weight: 700; }
        .np-preview-pair { display: flex; gap: 3mm; padding: 3mm; border: 1px solid #e7e5e4; border-radius: 3mm; background: #fff; cursor: pointer; font: inherit; text-align: left; }
        .np-preview-pair:hover { border-color: #3033a1; box-shadow: 0 4px 14px #3033a122; }
        .np-preview-pair:focus-visible { outline: 2px solid #3033a1; outline-offset: 2px; }
        .np-print-root { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body:has(#id-card-print-root) * { visibility: hidden !important; }
          #id-card-print-root, #id-card-print-root * { visibility: visible !important; }
          #id-card-print-root { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          #id-card-print-grid { display: grid !important; grid-template-columns: repeat(3, 54mm); gap: 5mm; width: 100%; box-sizing: border-box; padding: 8mm; align-content: start; justify-content: center; }
          .np-id-card { zoom: 1; box-shadow: none !important; border: .2mm solid #999; break-inside: avoid; page-break-inside: avoid; }
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

        <div className="no-print card flex flex-wrap items-center gap-3 p-4">
          <button className="btn-secondary" onClick={() => { setSelected(new Set()); setSearch(""); void (tab === "students" ? loadStudents() : loadStaff()); }}><RefreshCw size={15} /> Reload</button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all shown
          </label>
          <span className="text-sm text-stone-500">{selected.size} selected</span>
          <button className="btn-primary" onClick={printSelected} disabled={selected.size === 0}><Printer size={16} /> Print cards</button>
          <span className="text-xs text-stone-500">Click any card below to open print preview. CR80 cards print 9 per A4 page.</span>
        </div>

        <div className="no-print grid gap-5 xl:grid-cols-[320px_1fr]">
          <article className="card max-h-[540px] overflow-y-auto">
            <div className="sticky top-0 border-b border-stone-100 bg-white px-4 py-3"><h2 className="font-bold text-[#1f2136]">{tab === "students" ? "Students" : "Staff"} <span className="text-xs font-normal text-stone-500">({current.length})</span></h2></div>
            {loading ? <p className="p-4 text-sm text-stone-500">Loading…</p> : current.length === 0 ? <p className="p-4 text-sm text-stone-400">No records found.</p> : (
              <ul className="divide-y divide-stone-100">
                {tab === "students" ? visibleStudents.map((s) => (
                  <li key={s.id} className="flex items-center gap-1 pr-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.studentName || "Student"}</span><span className="block text-xs text-stone-500">{s.admissionNumber || "—"} · {CLASS_LABELS[s.class || s.className || ""] || s.class || s.className || "—"}{s.section ? `-${s.section}` : ""}</span></span>
                    </label>
                    <button type="button" onClick={() => printPeople([studentCard(s)])} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-[#3033a1]" title="Print card"><Printer size={15} /></button>
                  </li>
                )) : visibleStaff.map((s) => (
                  <li key={s.id} className="flex items-center gap-1 pr-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block text-xs text-stone-500">{s.employeeId} · {s.role}{s.subject ? ` · ${s.subject}` : ""}</span></span>
                    </label>
                    <button type="button" onClick={() => printPeople([staffCard(s)])} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-[#3033a1]" title="Print card"><Printer size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card p-5">
            <div className="mb-4 flex items-center gap-2"><IdCard size={18} className="text-[#3033a1]" /><h2 className="font-bold text-[#1f2136]">Live preview</h2></div>
            {previewPeople.length === 0 ? <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">Select people on the left to preview their cards. Click a card to print.</p> : (
              <div className="flex flex-wrap gap-4 overflow-x-auto">
                {previewPeople.map((person) => (
                  <button key={person.id} type="button" className="np-preview-pair" onClick={() => printPeople([person])} title="Print this card">
                    <VendorIdCard person={person} side="front" />
                    <VendorIdCard person={person} side="back" />
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-stone-500">Preview shows up to 3 selected people (front and back). Each card is exactly CR80 54 × 86 mm; printing flows multiple cards per A4 page.</p>
          </article>
        </div>

        <div id="id-card-print-root" className="np-print-root">
          <div id="id-card-print-grid">
            {printRequest?.people.flatMap((person) => [
              <VendorIdCard key={`${person.id}-front`} person={person} side="front" />,
              <VendorIdCard key={`${person.id}-back`} person={person} side="back" />
            ])}
          </div>
        </div>
      </section>
    </>
  );
}

function VendorIdCard({ person, side }: { person: CardPerson; side: "front" | "back" }) {
  if (person.kind === "student") {
    return side === "front" ? <StudentFront person={person} /> : <StudentBack person={person} />;
  }
  return side === "front" ? <StaffFront person={person} /> : <StaffBack person={person} />;
}

function Photo({ src }: { src?: string }) {
  return <div className="np-ph" style={{ backgroundImage: `url("${src || AVATAR}")` }} />;
}

function StudentFront({ person }: { person: CardPerson }) {
  return (
    <div className="np-id-card np-s1">
      <svg className="np-bg" viewBox="0 0 54 86">
        <rect width="54" height="86" fill="#fdf7ea" />
        <path d="M0 24 Q20 38 54 16 V24 Q24 46 0 30Z" fill="#f5b800" />
        <path d="M0 30 Q24 46 54 24 V27 Q24 50 0 33Z" fill="#f08a00" />
        <path d="M0 0H54V13 Q27 21 0 13Z" fill="#1f3490" />
        <path d="M0 86V80 Q27 74 54 80V86Z" fill="#1f3490" />
        <path d="M0 79 Q27 73 54 79V80.2 Q27 74.2 0 80.2Z" fill="#f5b800" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="np-lg" src="/id-card-logo.png" alt="" />
      <div className="np-sn">SRI NARAYANA<br />HIGH SCHOOL</div>
      <div className="np-ad" style={{ top: "9.5mm" }}>Ghanpur, Jayashankar Bhupalpally</div>
      <Photo src={person.photo} />
      <div className="np-nm">{person.name}</div>
      <div className="np-rows">
        <div><b>{"Father's Name"}</b><span>{person.father}</span></div>
        <div><b>Class</b><span>{person.className}</span></div>
        <div><b>Admission No</b><span>{person.admissionNumber}</span></div>
        <div><b>D.O.B.</b><span>{person.dob}</span></div>
        <div><b>Mobile</b><span>{person.mobile}</span></div>
        <div><b>Address</b><span>{person.address}</span></div>
      </div>
    </div>
  );
}

function StudentBack({ person }: { person: CardPerson }) {
  return (
    <div className="np-id-card np-bk">
      <svg className="np-bg" viewBox="0 0 54 86">
        <rect width="54" height="86" fill="#fff" />
        <path d="M0 0H54V30 Q27 38 0 30Z" fill="#1f3490" />
        <path d="M0 30 Q27 38 54 30V32 Q27 40 0 32Z" fill="#f5b800" />
        <path d="M0 86V72 Q27 66 54 72V86Z" fill="#1f3490" />
        <path d="M0 71 Q27 65 54 71V72.4 Q27 66.4 0 72.4Z" fill="#f5b800" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="np-lg" src="/id-card-logo.png" alt="" />
      <div className="np-sn" style={{ top: "17mm" }}>SRI NARAYANA HIGH SCHOOL</div>
      <div className="np-ad" style={{ top: "23mm" }}>Ghanpur, Jayashankar Bhupalpally, Telangana<br />Ph: 6300038389</div>
      <div className="np-info">
        <div><b>School Code:</b> 17105</div>
        <div><b>Blood Group:</b> <span>{person.bloodGroup}</span></div>
        <div><b>Bus Route:</b> <span>{person.route}</span></div>
      </div>
      <div className="np-rt">If found, please return to the school.</div>
      <div className="np-pr">Principal</div>
      <div className="np-rec">Recognized by Telangana Government</div>
    </div>
  );
}

function StaffFront({ person }: { person: CardPerson }) {
  return (
    <div className="np-id-card np-t1">
      <svg className="np-bg" viewBox="0 0 54 86">
        <rect width="54" height="86" fill="#fff" />
        <path d="M0 0H54V30 Q30 40 0 24Z" fill="#f5b800" />
        <path d="M0 24 Q30 40 54 30V34 Q30 46 0 29Z" fill="#1f3490" />
        <path d="M0 86V72 Q27 65 54 72V86Z" fill="#1f3490" />
        <path d="M0 70.2 Q27 63.2 54 70.2V72 Q27 65 0 72Z" fill="#f5b800" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="np-lg" src="/id-card-logo.png" alt="" />
      <div className="np-sn">SRI NARAYANA<br />HIGH SCHOOL</div>
      <div className="np-ad" style={{ top: "9.5mm" }}>Ghanpur, Jayashankar Bhupalpally</div>
      <Photo src={person.photo} />
      <div className="np-nm">{person.name}</div>
      <div className="np-rows">
        <div><b>ID No</b><span>{person.employeeId}</span></div>
        <div><b>Designation</b><span>{person.designation}</span></div>
        <div><b>Phone</b><span>{person.mobile}</span></div>
        <div><b>Blood Group</b><span>{person.bloodGroup}</span></div>
      </div>
      <div className="np-ct">
        <b>CONTACT:</b>
        <p>Ghanpur, Jayashankar Bhupalpally, Telangana<br />Ph: 6300038389</p>
      </div>
    </div>
  );
}

function StaffBack({ person }: { person: CardPerson }) {
  return (
    <div className="np-id-card np-bk">
      <svg className="np-bg" viewBox="0 0 54 86">
        <rect width="54" height="86" fill="#fff" />
        <path d="M0 0H54V30 Q27 38 0 30Z" fill="#f5b800" />
        <path d="M0 30 Q27 38 54 30V32.4 Q27 40.4 0 32.4Z" fill="#1f3490" />
        <path d="M0 86V72 Q27 66 54 72V86Z" fill="#1f3490" />
        <path d="M0 71 Q27 65 54 71V72.4 Q27 66.4 0 72.4Z" fill="#f5b800" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="np-lg" src="/id-card-logo.png" alt="" />
      <div className="np-sn" style={{ top: "17mm", color: "#1f3490" }}>SRI NARAYANA HIGH SCHOOL</div>
      <div className="np-ad" style={{ top: "23mm", color: "#222" }}>Ghanpur, Jayashankar Bhupalpally, Telangana<br />Ph: 6300038389</div>
      <div className="np-info">
        <div><b>School Code:</b> 17105</div>
        <div><b>Emergency Contact:</b> <span>{person.emergencyContact}</span></div>
      </div>
      <div className="np-rt">If found, please return to the school.</div>
      <div className="np-pr">Principal</div>
      <div className="np-rec">Recognized by Telangana Government</div>
    </div>
  );
}
