"use client";

import {
  User,
  MapPin,
  Phone,
  Mail,
  Shield,
  Info,
  CalendarCheck,
  UserCircle,
  Hash,
  GraduationCap,
  Sparkles
} from "lucide-react";

const STATUS_STYLES: Record<
  string,
  { badge: string; dot: string; label: string }
> = {
  active: {
    badge: "border-emerald-300/25 bg-emerald-400/15 text-emerald-100",
    dot: "bg-emerald-400",
    label: "Active"
  },
  inactive: {
    badge: "border-rose-300/25 bg-rose-400/15 text-rose-100",
    dot: "bg-rose-400",
    label: "Inactive"
  },
  transferred: {
    badge: "border-amber-300/25 bg-amber-400/15 text-amber-100",
    dot: "bg-amber-400",
    label: "Transferred"
  },
  left: {
    badge: "border-indigo-300/25 bg-indigo-400/15 text-indigo-100",
    dot: "bg-indigo-400",
    label: "Left"
  },
  archived: {
    badge: "border-slate-300/25 bg-slate-400/15 text-slate-100",
    dot: "bg-slate-400",
    label: "Archived"
  }
};

export function StudentProfileHeader({ student }: { student: Record<string, unknown> }) {
  const name = String(student.studentName || "");
  const admissionNumber = String(student.admissionNumber || student.admissionNo || "");
  const className = String(student.class || "");
  const section = String(student.section || "");
  const rollNo = Number(student.rollNo || 0);
  const status = String(student.status || "active");
  const dateOfBirth = student.dateOfBirth
    ? new Date(String(student.dateOfBirth)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const dateOfAdmission = student.createdAt
    ? new Date(String(student.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const gender = String(student.gender || "—");
  const bloodGroup = String(student.bloodGroup || "—");
  const admissionStatus = String(student.admissionStatus || "—");
  const photoURL = String(student.photoURL || "");

  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.active;

  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "S";

  const details = [
    { label: "Date of Birth", value: dateOfBirth, icon: <CalendarCheck size={15} /> },
    { label: "Gender", value: gender, icon: <User size={15} /> },
    { label: "Blood Group", value: bloodGroup, icon: <Shield size={15} /> },
    { label: "Admission Date", value: dateOfAdmission, icon: <CalendarCheck size={15} /> },
    { label: "Father", value: String(student.fatherName || "—"), icon: <UserCircle size={15} /> },
    { label: "Mother", value: String(student.motherName || "—"), icon: <UserCircle size={15} /> },
    { label: "Student Phone", value: String(student.phone || "—"), icon: <Phone size={15} /> },
    { label: "Email", value: String(student.email || "—"), icon: <Mail size={15} /> },
    { label: "Address", value: String(student.address || "—"), icon: <MapPin size={15} /> },
    { label: "Aadhaar", value: String(student.aadhaarNumber || "—"), icon: <Info size={15} /> },
    { label: "EMIS ID", value: String(student.emisId || "—"), icon: <Info size={15} /> },
    { label: "Admission Status", value: admissionStatus.charAt(0).toUpperCase() + admissionStatus.slice(1), icon: <Shield size={15} /> }
  ];

  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#141735] p-5 text-white shadow-[0_28px_80px_-36px_rgba(28,31,83,0.9)] md:p-7">
      <div className="profile-grid absolute inset-0 opacity-[0.1]" aria-hidden="true" />
      <div className="profile-mesh profile-mesh-a" aria-hidden="true" />
      <div className="profile-mesh profile-mesh-b" aria-hidden="true" />
      <div className="profile-hero-shine" aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="profile-avatar-shell h-24 w-24 md:h-28 md:w-28">
          {photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoURL}
              alt={name || "Student"}
              className="profile-avatar-media h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="profile-avatar-media grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-[#4f63f6] via-[#5751b8] to-[#8a69de] text-3xl font-extrabold text-white">
              {initials}
            </div>
          )}
          <span className={`profile-status-dot ${statusStyle.dot}`} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/60">
              <Sparkles size={10} />
              Student Profile
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] ${statusStyle.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} aria-hidden="true" />
              {statusStyle.label}
            </span>
          </div>

          <h1 className="mt-2 truncate text-2xl font-extrabold tracking-tight text-white md:text-4xl">
            {name || "Student"}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/55">
            {className ? `Class ${className}${section ? ` · Section ${section}` : ""}` : "Class not assigned"}
            {rollNo > 0 ? ` · Roll No. ${rollNo}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="profile-chip">
              <Hash size={12} className="text-indigo-200" aria-hidden="true" />
              Adm No. {admissionNumber || "—"}
            </span>
            <span className="profile-chip">
              <GraduationCap size={12} className="text-indigo-200" aria-hidden="true" />
              Class {className || "—"}-{section || "—"}
            </span>
            {rollNo > 0 && (
              <span className="profile-chip">
                <UserCircle size={12} className="text-indigo-200" aria-hidden="true" />
                Roll No. {rollNo}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {details.map((detail, index) => (
          <DetailTile
            key={detail.label}
            label={detail.label}
            value={detail.value}
            icon={detail.icon}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

function DetailTile({
  label,
  value,
  icon,
  index
}: {
  label: string;
  value: string;
  icon: React.ReactElement;
  index: number;
}) {
  const truncated = value.length > 26 ? value.slice(0, 26) + "…" : value;
  return (
    <div
      className="profile-glass profile-rise flex min-w-0 items-center gap-2.5 rounded-2xl p-2.5"
      style={{ animationDelay: `${80 + index * 35}ms` }}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-indigo-100">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
        <p className="truncate text-xs font-bold text-white/90" title={value}>
          {truncated}
        </p>
      </div>
    </div>
  );
}
