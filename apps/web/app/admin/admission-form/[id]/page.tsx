"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { adminApiRequest } from "@/lib/adminApiClient";

type DocumentItem = { name?: string; url?: string };

interface StudentData {
  id: string;
  admissionNumber?: string;
  admissionNo?: string;
  rollNo?: number | string;
  studentName?: string;
  class?: string;
  classApplied?: string;
  section?: string;
  medium?: string;
  academicYear?: string;
  academicYearName?: string;
  academicYearId?: string;
  secondLanguage?: string;
  admissionType?: string;
  admissionStatus?: string;
  gender?: string;
  dateOfBirth?: string;
  aadhaarNumber?: string;
  studentAadhaar?: string;
  bloodGroup?: string;
  emisId?: string;
  nationality?: string;
  motherTongue?: string;
  category?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherMobile?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherMobile?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianRelation?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressLine?: string;
  villageArea?: string;
  mandal?: string;
  district?: string;
  pincode?: string;
  photoURL?: string;
  documentURLs?: DocumentItem[];
  previousSchool?: { name?: string; address?: string; yearLeft?: string; lastClass?: string; tcNo?: string } | string | null;
  lastClass?: string;
  tcNo?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string } | string | null;
  transportRequired?: boolean;
  transportRouteId?: string;
  transportRouteName?: string;
  transportStopName?: string;
  busRoute?: string;
  pickupPoint?: string;
  annualEnrollmentFee?: number | string;
  commitmentFee?: number | string;
  totalFeeAmount?: number | string;
  concession?: number | string;
  feePlan?: string;
  receiptNo?: string;
  studentLogin?: string;
  parentLogin?: string;
  verifiedBy?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("en-IN");
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return "";
}

function display(value: unknown) {
  return valueText(value) || "—";
}

function formatDate(value: unknown) {
  const raw = valueText(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function previousSchoolName(student: StudentData) {
  if (typeof student.previousSchool === "string") return student.previousSchool;
  return student.previousSchool?.name ?? "";
}

function previousSchoolValue(student: StudentData, key: "lastClass" | "tcNo") {
  if (typeof student.previousSchool === "string") return "";
  return student.previousSchool?.[key] ?? student[key] ?? "";
}

function emergencyValue(student: StudentData, key: "phone" | "relation" | "name") {
  if (typeof student.emergencyContact === "string") return key === "phone" ? student.emergencyContact : "";
  return student.emergencyContact?.[key] ?? "";
}

function documentNames(student: StudentData) {
  return (student.documentURLs ?? []).map((doc) => String(doc.name ?? "").toLowerCase()).join(" ");
}

function hasDocument(student: StudentData, needles: string[]) {
  const haystack = documentNames(student);
  return needles.some((needle) => haystack.includes(needle));
}

function Field({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  return (
    <div className={wide ? "field-box sm:col-span-2" : "field-box"}>
      <span>{label}</span>
      <strong>{display(value)}</strong>
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="admission-section">
      <h2>{number}. {title}</h2>
      <div className="admission-grid">{children}</div>
    </section>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <span className="check-item">
      <span className="check-box">{checked ? "✓" : ""}</span>
      {label}
    </span>
  );
}

export default function AdmissionFormPage() {
  const params = useParams();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const data = await adminApiRequest<{ success?: boolean; data: StudentData }>(
          `/api/admin/students/${params.id}`
        );
        if (data.data) setStudent(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void fetchStudent();
  }, [params.id]);

  const printedAt = useMemo(() => new Date(), []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#7d86a8]">Loading...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#ed515d]">Student not found</p>
      </div>
    );
  }

  const admissionNo = student.admissionNumber ?? student.admissionNo;
  const classApplied = student.classApplied ?? student.class;
  const fatherMobile = student.fatherMobile ?? student.fatherPhone ?? student.phone;
  const motherMobile = student.motherMobile ?? student.motherPhone;
  const academicYear = student.academicYearName ?? student.academicYear ?? student.academicYearId;
  const route = student.busRoute ?? student.transportRouteName ?? student.transportRouteId;
  const pickupPoint = student.pickupPoint ?? student.transportStopName;
  const feePlan = student.feePlan ?? (student.totalFeeAmount ? "Standard" : "");
  const createdBy = student.createdBy ?? student.verifiedBy ?? "";

  return (
    <div className="admission-print-root min-h-screen bg-[#f4f5fb] print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-3 shadow-sm print:hidden">
        <Link href="/admin/students" className="flex items-center gap-2 text-sm font-semibold text-[#3033a1] hover:underline">
          <ArrowLeft size={16} /> Back to Students
        </Link>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="mx-auto max-w-[920px] p-5 print:max-w-none print:p-0">
        <div className="print-area admission-sheet bg-white p-7 shadow-sm print:p-0 print:shadow-none">
          <header className="admission-header">
            <div>
              <h1>SRI NARAYANA HIGH SCHOOL</h1>
              <p>Ghanpur (M), Jayashankar Bhupalpally District</p>
              <p>Phone: 6300038389 <span>|</span> Academic Year: {display(academicYear)}</p>
            </div>
            <div className="student-photo">
              {student.photoURL ? <img src={student.photoURL} alt="Student" /> : <span>Student<br />Photo</span>}
            </div>
          </header>

          <div className="form-title">DIGITAL STUDENT ADMISSION FORM - ERP</div>

          <div className="top-strip">
            <Field label="Admission No." value={admissionNo} />
            <Field label="Date" value={formatDate(student.createdAt)} />
            <Field label="ERP ID" value={student.id} />
          </div>

          <Section number={1} title="ADMISSION DETAILS">
            <Field label="Class Applied" value={classApplied} />
            <Field label="Section" value={student.section} />
            <Field label="Medium" value={student.medium} />
            <Field label="Academic Year" value={academicYear} />
            <Field label="Second Language" value={student.secondLanguage} />
            <Field label="Admission Type" value={student.admissionType} />
          </Section>

          <Section number={2} title="STUDENT DETAILS">
            <Field label="Student Name" value={student.studentName} />
            <Field label="Gender" value={student.gender} />
            <Field label="DOB" value={formatDate(student.dateOfBirth)} />
            <Field label="Aadhaar No." value={student.studentAadhaar ?? student.aadhaarNumber} />
            <Field label="Blood Group" value={student.bloodGroup} />
            <Field label="EMIS / Child ID" value={student.emisId} />
            <Field label="Nationality" value={student.nationality} />
            <Field label="Mother Tongue" value={student.motherTongue} />
            <Field label="Category" value={student.category} />
          </Section>

          <Section number={3} title="PARENT / GUARDIAN DETAILS">
            <Field label="Father Name" value={student.fatherName} />
            <Field label="Mobile" value={fatherMobile} />
            <Field label="Occupation" value={student.fatherOccupation} />
            <Field label="Mother Name" value={student.motherName} />
            <Field label="Mobile" value={motherMobile} />
            <Field label="Occupation" value={student.motherOccupation} />
            <Field label="Guardian" value={student.guardianName ?? emergencyValue(student, "name")} />
            <Field label="Relation" value={student.guardianRelation ?? emergencyValue(student, "relation")} />
            <Field label="Emergency No." value={emergencyValue(student, "phone")} />
          </Section>

          <Section number={4} title="ADDRESS DETAILS">
            <Field label="House / Street" value={student.addressLine ?? student.address} />
            <Field label="Village / Area" value={student.villageArea} />
            <Field label="Mandal" value={student.mandal} />
            <Field label="District / PIN" value={`${valueText(student.district)}${student.pincode ? ` - ${student.pincode}` : ""}`} />
          </Section>

          <Section number={5} title="PREVIOUS SCHOOL / TRANSPORT / FEE">
            <Field label="Previous School" value={previousSchoolName(student)} />
            <Field label="Last Class" value={previousSchoolValue(student, "lastClass")} />
            <Field label="TC No." value={previousSchoolValue(student, "tcNo")} />
            <Field label="Transport" value={student.transportRequired || route || pickupPoint ? "Yes" : "No"} />
            <Field label="Route / Village" value={route} />
            <Field label="Pickup Point" value={pickupPoint} />
            <Field label="Fee Plan" value={feePlan} />
            <Field label="Concession" value={student.concession} />
            <Field label="Receipt No." value={student.receiptNo} />
          </Section>

          <section className="admission-section">
            <h2>6. DOCUMENTS CHECKLIST</h2>
            <div className="check-grid">
              <ChecklistItem label="Birth Certificate" checked={hasDocument(student, ["birth"])} />
              <ChecklistItem label="Student Aadhaar" checked={Boolean(student.aadhaarNumber) || hasDocument(student, ["student aadhaar", "aadhaar"])} />
              <ChecklistItem label="Parent Aadhaar" checked={hasDocument(student, ["parent aadhaar", "father aadhaar", "mother aadhaar"])} />
              <ChecklistItem label="TC / Bonafide" checked={Boolean(previousSchoolValue(student, "tcNo")) || hasDocument(student, ["tc", "bonafide"])} />
              <ChecklistItem label="Previous Report Card" checked={hasDocument(student, ["report"])} />
              <ChecklistItem label="Passport Photos" checked={Boolean(student.photoURL) || hasDocument(student, ["photo"])} />
              <ChecklistItem label="Caste / Income Certificate" checked={hasDocument(student, ["caste", "income"])} />
              <ChecklistItem label="Other" checked={(student.documentURLs ?? []).length > 0} />
            </div>
          </section>

          <section className="declaration">
            <h2>7. DECLARATION</h2>
            <p>
              I declare that the information given above is true. I agree to follow the school rules,
              fee schedule, attendance policy, uniform rules, and transport safety instructions.
            </p>
            <div className="signature-grid">
              <span>Parent Signature</span>
              <span>Student Signature</span>
              <span>Principal / Office</span>
            </div>
          </section>

          <section className="admission-section office-use">
            <h2>8. OFFICE USE ONLY - ERP ENTRY</h2>
            <div className="admission-grid">
              <Field label="Status" value={student.admissionStatus ?? "Pending"} />
              <Field label="Verified By" value={student.verifiedBy} />
              <Field label="Created By" value={createdBy} />
              <Field label="Student Login" value={student.studentLogin} />
              <Field label="Parent Login" value={student.parentLogin} />
              <Field label="Printed" value={`${createdBy || "ERP"} - ${printedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ${printedAt.toLocaleDateString("en-IN")}`} wide />
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .admission-sheet {
          color: #172033;
          font-family: Arial, "Helvetica Neue", sans-serif;
          line-height: 1.3;
        }

        .admission-header {
          align-items: flex-start;
          border: 1px solid #cfd8e8;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 16px;
        }

        .admission-header h1 {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.04em;
          margin: 0 0 5px;
        }

        .admission-header p {
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          margin: 2px 0;
        }

        .student-photo {
          align-items: center;
          border: 1.5px dashed #94a3b8;
          color: #64748b;
          display: flex;
          font-size: 11px;
          font-weight: 800;
          height: 96px;
          justify-content: center;
          line-height: 1.25;
          text-align: center;
          width: 86px;
        }

        .student-photo img {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .form-title {
          background: #17217f;
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin: 10px 0;
          padding: 9px 12px;
          text-align: center;
        }

        .top-strip,
        .admission-grid {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .top-strip {
          margin-bottom: 10px;
        }

        .admission-section {
          border: 1px solid #d7deeb;
          margin-top: 10px;
          break-inside: avoid;
        }

        .admission-section h2,
        .declaration h2 {
          background: #eef2ff;
          border-bottom: 1px solid #d7deeb;
          color: #17217f;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
          margin: 0;
          padding: 7px 9px;
        }

        .admission-grid {
          padding: 8px;
        }

        .field-box {
          border: 1px solid #e2e8f0;
          min-height: 48px;
          padding: 7px 8px;
        }

        .field-box span {
          color: #64748b;
          display: block;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .field-box strong {
          color: #111827;
          display: block;
          font-size: 12px;
          font-weight: 800;
          margin-top: 3px;
          overflow-wrap: anywhere;
        }

        .check-grid {
          display: grid;
          gap: 8px 14px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 10px;
        }

        .check-item {
          align-items: center;
          color: #1f2937;
          display: inline-flex;
          font-size: 11px;
          font-weight: 700;
          gap: 6px;
        }

        .check-box {
          align-items: center;
          border: 1px solid #64748b;
          display: inline-flex;
          font-size: 10px;
          font-weight: 900;
          height: 14px;
          justify-content: center;
          line-height: 1;
          width: 14px;
        }

        .declaration {
          border: 1px solid #d7deeb;
          margin-top: 10px;
          break-inside: avoid;
        }

        .declaration p {
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          margin: 0;
          padding: 9px 10px 22px;
        }

        .signature-grid {
          display: grid;
          gap: 22px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 18px 10px 10px;
        }

        .signature-grid span {
          border-top: 1px solid #64748b;
          color: #475569;
          font-size: 10px;
          font-weight: 800;
          padding-top: 5px;
          text-align: center;
        }

        .office-use {
          margin-bottom: 0;
        }

        @media (max-width: 720px) {
          .admission-header {
            flex-direction: column;
          }

          .top-strip,
          .admission-grid,
          .check-grid,
          .signature-grid {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          @page {
            margin: 10mm;
            size: A4;
          }

          body {
            background: #fff !important;
          }

          .admission-sheet {
            box-shadow: none !important;
          }

          .admission-section {
            margin-top: 7px;
          }

          .field-box {
            min-height: 41px;
            padding: 5px 7px;
          }

          .field-box strong {
            font-size: 10.5px;
          }

          .declaration p {
            padding-bottom: 15px;
          }
        }
      `}</style>
    </div>
  );
}
