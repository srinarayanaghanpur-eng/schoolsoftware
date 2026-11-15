"use client";

import { Users, Phone, Mail, MapPin, Microscope, Building, UserCircle, Shield, FileText } from "lucide-react";

type SectionProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactElement;
  children: React.ReactNode;
};

function Section({ title, subtitle, icon, children }: SectionProps) {
  return (
    <section className="profile-card-hover card overflow-hidden p-4 md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#5751b8] text-white shadow-lg shadow-primary/20">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailItem({ label, value, icon }: { label: string; value: string; icon: React.ReactElement }) {
  const truncated = value.length > 32 ? value.slice(0, 32) + "…" : value;
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/60 hover:shadow-sm">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xs font-semibold leading-relaxed text-foreground" title={value}>
          {truncated}
        </p>
      </div>
    </div>
  );
}

export function OverviewTab({ student }: { student: Record<string, unknown> }) {
  const name = String(student.studentName || "—");
  const admissionNumber = String(student.admissionNumber || student.admissionNo || "—");
  const className = String(student.class || "—");
  const section = String(student.section || "—");
  const rollNo = Number(student.rollNo || 0);
  const dateOfBirth = student.dateOfBirth
    ? new Date(String(student.dateOfBirth)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Not recorded";
  const gender = String(student.gender || "Not recorded");
  const bloodGroup = String(student.bloodGroup || "Not recorded");
  const address = String(student.address || "Not recorded");
  const villageArea = String(student.villageArea || "—");
  const mandal = String(student.mandal || "—");
  const district = String(student.district || "—");
  const pincode = String(student.pincode || "—");
  const email = String(student.email || "—");
  const phone = String(student.phone || "—");
  const fatherName = String(student.fatherName || "—");
  const fatherPhone = String(student.fatherPhone || "—");
  const fatherOccupation = String(student.fatherOccupation || "—");
  const motherName = String(student.motherName || "—");
  const motherPhone = String(student.motherPhone || "—");
  const motherOccupation = String(student.motherOccupation || "—");
  const emergencyContact = student.emergencyContact as Record<string, string> | null | undefined;
  const previousSchool = student.previousSchool as Record<string, string> | null | undefined;
  const aadhaarNumber = String(student.aadhaarNumber || "—");
  const emisId = String(student.emisId || "—");
  const nationality = String(student.nationality || "—");
  const motherTongue = String(student.motherTongue || "—");
  const category = String(student.category || "—");
  const medium = String(student.medium || "—");
  const secondLanguage = String(student.secondLanguage || "—");
  const admissionType = String(student.admissionType || "—");
  const transportRouteId = String(student.transportRouteId || "—");
  const transportStopName = String(student.transportStopName || "—");
  const transportFee = Number(student.transportFee || 0);
  const academicYearId = String(student.academicYearId || "—");

  return (
    <div className="space-y-5">
      <Section title="Personal Details" subtitle="Student identity and personal information" icon={<UserCircle size={18} />}>
        <DetailItem label="Full Name" value={name} icon={<UserCircle size={14} />} />
        <DetailItem label="Admission Number" value={admissionNumber} icon={<FileText size={14} />} />
        <DetailItem label="Class & Section" value={`${className} - ${section}${rollNo > 0 ? ` (Roll No. ${rollNo})` : ""}`} icon={<Microscope size={14} />} />
        <DetailItem label="Date of Birth" value={dateOfBirth} icon={<Microscope size={14} />} />
        <DetailItem label="Gender" value={gender} icon={<UserCircle size={14} />} />
        <DetailItem label="Blood Group" value={bloodGroup} icon={<Shield size={14} />} />
        <DetailItem label="Aadhaar Number" value={aadhaarNumber} icon={<FileText size={14} />} />
        <DetailItem label="EMIS ID" value={emisId} icon={<FileText size={14} />} />
        <DetailItem label="Nationality" value={nationality} icon={<Building size={14} />} />
        <DetailItem label="Mother Tongue" value={motherTongue} icon={<Microscope size={14} />} />
        <DetailItem label="Category" value={category} icon={<Shield size={14} />} />
        <DetailItem label="Medium of Instruction" value={medium} icon={<Building size={14} />} />
        <DetailItem label="Second Language" value={secondLanguage} icon={<Microscope size={14} />} />
        <DetailItem label="Admission Type" value={admissionType} icon={<FileText size={14} />} />
      </Section>

      <Section title="Admission Details" subtitle="Admission record and academic placement" icon={<Building size={18} />}>
        <DetailItem label="Admission Date" value={student.createdAt ? new Date(String(student.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not recorded"} icon={<FileText size={14} />} />
        <DetailItem label="Academic Year" value={academicYearId} icon={<Building size={14} />} />
        <DetailItem label="Class" value={className} icon={<Microscope size={14} />} />
        <DetailItem label="Section" value={section} icon={<Microscope size={14} />} />
        <DetailItem label="Roll Number" value={rollNo > 0 ? String(rollNo) : "Not assigned"} icon={<FileText size={14} />} />
        <DetailItem label="Transport Route" value={transportRouteId} icon={<Shield size={14} />} />
        <DetailItem label="Transport Stop" value={transportStopName || "—"} icon={<MapPin size={14} />} />
        <DetailItem label="Transport Fee" value={transportFee > 0 ? `₹${transportFee.toLocaleString("en-IN")}` : "Not assigned"} icon={<Shield size={14} />} />
        <DetailItem label="Status" value={String(student.status || "active").charAt(0).toUpperCase() + String(student.status || "active").slice(1)} icon={<Shield size={14} />} />
      </Section>

      <Section title="Parent & Guardian Details" subtitle="Contact information for parents and emergency contacts" icon={<Users size={18} />}>
        <DetailItem label="Father's Name" value={fatherName} icon={<UserCircle size={14} />} />
        <DetailItem label="Father's Phone" value={fatherPhone} icon={<Phone size={14} />} />
        <DetailItem label="Father's Occupation" value={fatherOccupation} icon={<Microscope size={14} />} />
        <DetailItem label="Mother's Name" value={motherName} icon={<UserCircle size={14} />} />
        <DetailItem label="Mother's Phone" value={motherPhone} icon={<Phone size={14} />} />
        <DetailItem label="Mother's Occupation" value={motherOccupation} icon={<Microscope size={14} />} />
        {emergencyContact && (
          <DetailItem label="Emergency Contact" value={`${emergencyContact.name || "—"} · ${emergencyContact.phone || "—"} · ${emergencyContact.relation || "—"}`} icon={<Phone size={14} />} />
        )}
        <DetailItem label="Primary Contact" value={phone} icon={<Phone size={14} />} />
        <DetailItem label="Email" value={email} icon={<Mail size={14} />} />
      </Section>

      <Section title="Address Details" subtitle="Residential address" icon={<MapPin size={18} />}>
        <DetailItem label="Address" value={address} icon={<MapPin size={14} />} />
        <DetailItem label="Village / Area" value={villageArea} icon={<MapPin size={14} />} />
        <DetailItem label="Mandal" value={mandal} icon={<MapPin size={14} />} />
        <DetailItem label="District" value={district} icon={<MapPin size={14} />} />
        <DetailItem label="Pincode" value={pincode} icon={<FileText size={14} />} />
      </Section>

      {previousSchool && (
        <Section title="Previous School" subtitle="Details of the school last attended" icon={<Building size={18} />}>
          <DetailItem label="School Name" value={previousSchool.name || "—"} icon={<Building size={14} />} />
          <DetailItem label="Address" value={previousSchool.address || "—"} icon={<MapPin size={14} />} />
          <DetailItem label="Year Left" value={previousSchool.yearLeft || "—"} icon={<FileText size={14} />} />
          <DetailItem label="Last Class" value={previousSchool.lastClass || "—"} icon={<FileText size={14} />} />
          <DetailItem label="TC Number" value={previousSchool.tcNo || "—"} icon={<FileText size={14} />} />
        </Section>
      )}
    </div>
  );
}
