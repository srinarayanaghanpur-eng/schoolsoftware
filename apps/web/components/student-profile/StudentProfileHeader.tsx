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
  GraduationCap
} from "lucide-react";

const STATUS_STYLES: Record<
  string,
  { badge: string; dot: string; label: string }
> = {
  active: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Active"
  },
  inactive: {
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Inactive"
  },
  transferred: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Transferred"
  },
  left: {
    badge:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
    dot: "bg-indigo-500",
    label: "Left"
  }
};

const chipClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-foreground";

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

  return (
    <div className="card overflow-hidden p-0">
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-[#4f63f6] to-[#8a69de]" />
      <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-12 md:gap-7 md:p-6">
        <div className="flex flex-col items-center justify-center gap-3 md:col-span-3">
          <div className="relative">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoURL}
                alt={name}
                className="h-28 w-28 rounded-full object-cover shadow-md ring-4 ring-card"
              />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-primary to-[#5751b8] text-3xl font-extrabold text-white shadow-md ring-4 ring-card">
                {initials}
              </div>
            )}
            <span
              className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-card ${statusStyle.dot}`}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="min-w-0 md:col-span-9">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{name}</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${statusStyle.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} aria-hidden="true" />
              {statusStyle.label}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className={chipClass}>
              <Hash size={12} className="text-primary" aria-hidden="true" />
              Adm No. {admissionNumber || "—"}
            </span>
            <span className={chipClass}>
              <GraduationCap size={12} className="text-primary" aria-hidden="true" />
              Class {className || "—"}-{section || "—"}
            </span>
            {rollNo > 0 && (
              <span className={chipClass}>
                <UserCircle size={12} className="text-primary" aria-hidden="true" />
                Roll No. {rollNo}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailRow label="Date of Birth" value={dateOfBirth} icon={<User size={14} />} />
            <DetailRow label="Gender" value={gender} icon={<User size={14} />} />
            <DetailRow label="Blood Group" value={bloodGroup} icon={<Shield size={14} />} />
            <DetailRow label="Admission Date" value={dateOfAdmission} icon={<CalendarCheck size={14} />} />
            <DetailRow
              label="Admission Status"
              value={admissionStatus.charAt(0).toUpperCase() + admissionStatus.slice(1)}
              icon={<Shield size={14} />}
            />
            <DetailRow label="Address" value={String(student.address || "—")} icon={<MapPin size={14} />} />
            <DetailRow label="Father" value={String(student.fatherName || "—")} icon={<UserCircle size={14} />} />
            <DetailRow label="Mother" value={String(student.motherName || "—")} icon={<UserCircle size={14} />} />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <DetailRow label="Father Phone" value={String(student.fatherPhone || "—")} icon={<Phone size={14} />} />
            <DetailRow label="Mother Phone" value={String(student.motherPhone || "—")} icon={<Phone size={14} />} />
            <DetailRow label="Student Phone" value={String(student.phone || "—")} icon={<Phone size={14} />} />
            <DetailRow label="Email" value={String(student.email || "—")} icon={<Mail size={14} />} />
            <DetailRow label="Aadhaar" value={String(student.aadhaarNumber || "—")} icon={<Info size={14} />} />
            <DetailRow label="EMIS ID" value={String(student.emisId || "—")} icon={<Info size={14} />} />
            <DetailRow label="Transport Route" value={String(student.transportRouteId || "—")} icon={<Shield size={14} />} />
            <DetailRow label="Category" value={String(student.category || "—")} icon={<Info size={14} />} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon: React.ReactElement }) {
  const truncated = value.length > 28 ? value.slice(0, 28) + "…" : value;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 transition hover:bg-muted/60">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-semibold text-foreground" title={value}>
          {truncated}
        </p>
      </div>
    </div>
  );
}
