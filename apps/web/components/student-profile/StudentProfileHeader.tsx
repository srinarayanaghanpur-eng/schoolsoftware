"use client";

import Link from "next/link";
import {
  User,
  MapPin,
  Phone,
  Mail,
  Cake,
  Microscope,
  Building,
  Shield,
  Edit2,
  Info,
  CalendarCheck,
  UserCircle,
  TrendingDown
} from "lucide-react";

type StatusColor = {
  active: string;
  inactive: string;
  transferred: string;
  left: string;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "#e6f8ef", text: "#0f8d52", border: "#d6f2e3" },
  inactive: { bg: "#fff7f8", text: "#b33b51", border: "#ffeaea" },
  transferred: { bg: "#fff7e6", text: "#ad7413", border: "#ffe0c7" },
  left: { bg: "#f7f8fd", text: "#3033a1", border: "#e3e8ff" }
};

export function StudentProfileHeader({ student, canEdit }: { student: Record<string, unknown>; canEdit?: boolean }) {
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
  const academicYearId = String(student.academicYearId || "");
  const photoURL = String(student.photoURL || "");

  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.active;

  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "S";

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
        <div className="md:col-span-4 flex flex-col items-center gap-3">
          <div className="relative group">
            <div className="relative">
              {photoURL ? (
                <img src={photoURL} alt={name} className="w-28 h-28 rounded-full object-cover border-2 border-white shadow-sm" />
              ) : (
                <div className="w-28 h-28 rounded-full flex items-center justify-center bg-[#eef0ff] text-[#3033a1] text-3xl font-extrabold border-2 border-white shadow-sm">
                  {initials}
                </div>
              )}
              {canEdit && (
                <button type="button" className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-white ring-2 ring-white shadow-sm transition hover:bg-[#f4f5fb]">
                  <Edit2 size={14} className="text-[#3033a1]" />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs font-medium text-[#7d86a8]">Student Photo</p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusStyle.bg} text-${statusStyle.text} border border-${statusStyle.border}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>

        <div className="md:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-[#1f2136] tracking-tight">{name}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusStyle.bg} text-${statusStyle.text} border border-${statusStyle.border}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <p className="text-sm font-semibold text-[#3033a1]">
            Admission No. {admissionNumber} &nbsp;·&nbsp; Class {className}-{section}{rollNo > 0 ? ` &nbsp;·&nbsp; Roll No. ${rollNo}` : ""}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DetailRow label="Date of Birth" value={dateOfBirth} icon={<User size={14} />} />
            <DetailRow label="Gender" value={gender} icon={<User size={14} />} />
            <DetailRow label="Blood Group" value={bloodGroup} icon={<Shield size={14} />} />
            <DetailRow label="Admission Date" value={dateOfAdmission} icon={<CalendarCheck size={14} />} />
            <DetailRow label="Academic Year" value={academicYearId || "—"} icon={<Building size={14} />} />
            <DetailRow label="Address" value={String(student.address || "—")} icon={<MapPin size={14} />} />
            <DetailRow label="Father" value={String(student.fatherName || "—")} icon={<UserCircle size={14} />} />
            <DetailRow label="Mother" value={String(student.motherName || "—")} icon={<UserCircle size={14} />} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
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
    <div className="flex items-center gap-2 rounded-xl border border-[#edf0f7] bg-[#f7f8fd] p-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ff] text-[#3033a1]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">{label}</p>
        <p className="text-xs font-semibold text-[#1f2136] truncate" title={value}>{truncated}</p>
      </div>
    </div>
  );
}
