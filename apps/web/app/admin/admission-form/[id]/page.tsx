"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Download, Pencil } from "lucide-react";
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
  classId?: string;
  section?: string;
  sectionId?: string;
  medium?: string;
  academicYear?: string;
  academicYearName?: string;
  academicYearId?: string;
  secondLanguage?: string;
  admissionType?: string;
  admissionStatus?: string;
  gender?: string;
  dateOfBirth?: string | { _seconds?: number; _nanoseconds?: number } | null;
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
  previousSchool?:
    | { name?: string; address?: string; yearLeft?: string; lastClass?: string; tcNo?: string }
    | string
    | null;
  lastClass?: string;
  tcNo?: string;
  emergencyContact?:
    | { name?: string; phone?: string; relation?: string }
    | string
    | null;
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
  feeHeads?: { name: string; amount: number }[] | null;
  receiptNo?: string;
  studentLogin?: string;
  parentLogin?: string;
  verifiedBy?: string;
  createdBy?: string;
  createdAt?: string | { _seconds?: number; _nanoseconds?: number };
  updatedAt?: string | { _seconds?: number; _nanoseconds?: number };
  branchId?: string;
  schoolId?: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface BranchInfo {
  id: string;
  name: string;
}

interface AppUser {
  uid: string;
  displayName: string;
}

interface TransportRoute {
  id: string;
  name: string;
}

function resolveValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return "";
}

function display(value: unknown): string {
  return resolveValue(value) || "—";
}

function extractDate(
  value: unknown
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as { _seconds?: number; _nanoseconds?: number };
    if (typeof obj._seconds === "number") {
      return new Date(obj._seconds * 1000 + (obj._nanoseconds ?? 0) / 1e6);
    }
  }
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown): string {
  const d = extractDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatDateTime(value: unknown): string {
  const d = extractDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

function previousSchoolName(student: StudentData): string {
  if (typeof student.previousSchool === "string") return student.previousSchool;
  return student.previousSchool?.name ?? "";
}

function previousSchoolValue(
  student: StudentData,
  key: "lastClass" | "tcNo"
): string {
  if (typeof student.previousSchool === "string") return "";
  return student.previousSchool?.[key] ?? student[key] ?? "";
}

function emergencyValue(
  student: StudentData,
  key: "phone" | "relation" | "name"
): string {
  if (typeof student.emergencyContact === "string")
    return key === "phone" ? student.emergencyContact : "";
  return student.emergencyContact?.[key] ?? "";
}

function documentNames(student: StudentData): string {
  return (student.documentURLs ?? [])
    .map((doc) => String(doc.name ?? "").toLowerCase())
    .join(" ");
}

function hasDocument(student: StudentData, needles: string[]): boolean {
  const haystack = documentNames(student);
  return needles.some((needle) => haystack.includes(needle));
}

// ---------- Styled sub-components ----------

function FieldBox({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "af-field af-field-wide" : "af-field"}>
      <span className="af-label">{label}</span>
      <span className="af-value">{display(value)}</span>
    </div>
  );
}

function FormSection({
  number,
  title,
  children,
  cols = 3,
}: {
  number: number;
  title: string;
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div className="af-section">
      <div className="af-section-heading">
        <span className="af-section-number">{number}</span>
        <span>{title}</span>
      </div>
      <div className={cols === 2 ? "af-grid af-grid-2" : "af-grid af-grid-3"}>
        {children}
      </div>
    </div>
  );
}

function ChecklistItem({
  label,
  checked,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="af-check-item">
      <span className="af-check-box">
        {checked && <span className="af-check-tick">✓</span>}
      </span>
      <span className="af-check-label">{label}</span>
    </label>
  );
}

function SignatureLine({ title }: { title: string }) {
  return (
    <div className="af-signature">
      <div className="af-signature-line" />
      <span className="af-signature-title">{title}</span>
    </div>
  );
}

function DataRow({
  label,
  value,
  labelWidth = 140,
}: {
  label: string;
  value: unknown;
  labelWidth?: number;
}) {
  return (
    <div className="af-data-row">
      <span className="af-data-label" style={{ minWidth: labelWidth }}>
        {label}
      </span>
      <span className="af-data-sep">:</span>
      <span className="af-data-value">{display(value)}</span>
    </div>
  );
}

// ---------- Main page component ----------

export default function AdmissionFormPage() {
  const params = useParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lookup data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // Build lookup maps
  const yearMap = useMemo(() => {
    const m = new Map<string, string>();
    academicYears.forEach((y) => m.set(y.id, y.name));
    return m;
  }, [academicYears]);

  const branchMap = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [branches]);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.uid, u.displayName));
    return m;
  }, [users]);

  const routeMap = useMemo(() => {
    const m = new Map<string, string>();
    routes.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [routes]);

  // Fetch student
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await adminApiRequest<{
          success?: boolean;
          data: StudentData;
        }>(`/api/admin/students/${params.id}`);
        if (result.data) {
          setStudent(result.data);
        } else {
          setError("Student not found");
        }
      } catch (err) {
        console.error("Error fetching student:", err);
        setError("Failed to load student data");
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [params.id]);

  // Fetch lookups
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [yearsRes, branchesRes, usersRes, routesRes] =
          await Promise.all([
            adminApiRequest<{ ok: boolean; years: AcademicYear[] }>(
              "/api/admin/academic-years"
            ),
            adminApiRequest<{ ok: boolean; branches: BranchInfo[] }>(
              "/api/admin/branches"
            ),
            adminApiRequest<{ ok: boolean; users: AppUser[] }>(
              "/api/admin/users"
            ),
            adminApiRequest<{ ok: boolean; routes: TransportRoute[] }>(
              "/api/admin/transport/routes"
            ),
          ]);

      if (yearsRes.years) setAcademicYears(yearsRes.years);
      if (branchesRes.branches) setBranches(branchesRes.branches);
      if (usersRes.users) setUsers(usersRes.users);
      if (routesRes.routes) setRoutes(routesRes.routes);
      } catch (err) {
        console.error("Error fetching lookups:", err);
      } finally {
        setLookupsLoaded(true);
      }
    };
    void fetchLookups();
  }, []);

  const printedAt = useMemo(() => new Date(), []);

  // ---- Resolved values ----
  const resolved = useMemo(() => {
    if (!student) return null;

    const admissionNo = resolveValue(
      student.admissionNumber ?? student.admissionNo
    );
    const name = resolveValue(student.studentName);
    const classApplied = resolveValue(student.classApplied ?? student.class);
    const section = resolveValue(student.section);

    const ayId = resolveValue(
      student.academicYearId ??
        student.academicYear ??
        student.academicYearName
    );
    const academicYearName =
      student.academicYearName || yearMap.get(ayId) || ayId;

    const branchName = branchMap.get(resolveValue(student.branchId)) || "";

    const fatherName = resolveValue(student.fatherName);
    const fatherMobile = resolveValue(
      student.fatherMobile ?? student.fatherPhone ?? student.phone
    );
    const fatherOcc = resolveValue(student.fatherOccupation);

    const motherName = resolveValue(student.motherName);
    const motherMobile = resolveValue(
      student.motherMobile ?? student.motherPhone
    );
    const motherOcc = resolveValue(student.motherOccupation);

    const guardianName = resolveValue(
      student.guardianName ?? emergencyValue(student, "name")
    );
    const guardianRelation = resolveValue(
      student.guardianRelation ?? emergencyValue(student, "relation")
    );
    const emergencyPhone = resolveValue(emergencyValue(student, "phone"));

    const addressLine = resolveValue(
      student.addressLine ?? student.address
    );
    const village = resolveValue(student.villageArea);
    const mandal = resolveValue(student.mandal);
    const district = resolveValue(student.district);
    const pincode = resolveValue(student.pincode);

    const prevSchool = resolveValue(previousSchoolName(student));
    const lastClass = resolveValue(previousSchoolValue(student, "lastClass"));
    const tcNo = resolveValue(previousSchoolValue(student, "tcNo"));

    const transportRequired = student.transportRequired
      ? "Yes"
      : resolveValue(student.transportRouteId) ||
        resolveValue(student.transportStopName)
        ? "Yes"
        : "No";
    const routeName =
      routeMap.get(resolveValue(student.transportRouteId)) ||
      resolveValue(student.busRoute ?? student.transportRouteName);
    const pickupPoint = resolveValue(
      student.pickupPoint ?? student.transportStopName
    );

    const feePlan = resolveValue(
      student.feePlan ??
        (student.totalFeeAmount ? "Standard" : "")
    );
    const feeTypes = student.feeHeads
      ? student.feeHeads.map((h) => h.name).join(", ")
      : "";
    const totalFee = student.totalFeeAmount ?? student.commitmentFee ?? "";
    const concession = student.concession ?? student.totalFeeAmount
      ? Number(student.totalFeeAmount) - Number(student.commitmentFee ?? student.totalFeeAmount)
      : "";

    const verifiedByUid = resolveValue(student.verifiedBy);
    const createdByUid = resolveValue(student.createdBy);

    const verifiedByName = userMap.get(verifiedByUid) || verifiedByUid || "—";
    const createdByName = userMap.get(createdByUid) || createdByUid || "—";

    const admissionDate = student.createdAt;

    const aadhaar = resolveValue(
      student.studentAadhaar ?? student.aadhaarNumber
    );
    const dob = student.dateOfBirth;
    const gender = resolveValue(student.gender);
    const bloodGroup = resolveValue(student.bloodGroup);
    const emis = resolveValue(student.emisId);
    const nationality = resolveValue(student.nationality);
    const motherTongue = resolveValue(student.motherTongue);
    const category = resolveValue(student.category);
    const medium = resolveValue(student.medium);
    const secondLang = resolveValue(student.secondLanguage);
    const admissionType = resolveValue(student.admissionType);
    const admissionStatus = resolveValue(
      student.admissionStatus ?? "Pending"
    );
    const studentLogin = resolveValue(student.studentLogin);
    const parentLogin = resolveValue(student.parentLogin);

    return {
      admissionNo,
      name,
      classApplied,
      section,
      academicYearName,
      branchName,
      fatherName,
      fatherMobile,
      fatherOcc,
      motherName,
      motherMobile,
      motherOcc,
      guardianName,
      guardianRelation,
      emergencyPhone,
      addressLine,
      village,
      mandal,
      district,
      pincode,
      prevSchool,
      lastClass,
      tcNo,
      transportRequired,
      routeName,
      pickupPoint,
      feePlan,
      feeTypes,
      totalFee,
      concession,
      verifiedByName,
      createdByName,
      admissionDate,
      aadhaar,
      dob,
      gender,
      bloodGroup,
      emis,
      nationality,
      motherTongue,
      category,
      medium,
      secondLang,
      admissionType,
      admissionStatus,
      studentLogin,
      parentLogin,
    };
  }, [student, userMap, routeMap, yearMap, branchMap]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleEdit = () => {
    router.push(`/admin/students?id=${params.id}&edit=1`);
  };

  if (loading || !lookupsLoaded) {
    return (
      <div className="af-loading">
        <div className="af-loading-spinner" />
        <span>Loading admission form...</span>
      </div>
    );
  }

  if (error || !student || !resolved) {
    return (
      <div className="af-loading">
        <p className="af-error-text">{error || "Student not found"}</p>
        <button
          onClick={() => router.push("/admin/students")}
          className="af-back-btn"
        >
          ← Back to Students
        </button>
      </div>
    );
  }

  const r = resolved;

  return (
    <div className="af-page-root">
      {/* Fixed Action Bar */}
      <div className="af-action-bar">
        <button
          onClick={() => router.push("/admin/students")}
          className="af-action-btn af-action-back"
        >
          <ArrowLeft size={16} />
          <span>Back to Students</span>
        </button>

        <div className="af-action-right">
          <button onClick={handleEdit} className="af-action-btn af-action-edit">
            <Pencil size={16} />
            <span>Edit Student</span>
          </button>
          <button
            onClick={handlePrint}
            className="af-action-btn af-action-print"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="af-action-btn af-action-download"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* A4 Sheet */}
      <div className="af-a4-wrapper">
        <div ref={printRef} className="af-a4-sheet" id="admission-form-print">
          {/* Header */}
          <div className="af-header">
            <div className="af-header-left">
              <div className="af-logo">
                <img
                  src="/sri-narayana-high-school-logo.jpg"
                  alt="School Logo"
                />
              </div>
              <div className="af-school-info">
                <h1 className="af-school-name">
                  SRI NARAYANA HIGH SCHOOL
                </h1>
                <p className="af-school-address">
                  Ghanpur (M), Jayashankar Bhupalpally District
                </p>
                <p className="af-school-contact">
                  Phone: 6300038389 &nbsp;|&nbsp; Academic Year:{" "}
                  {r.academicYearName}
                </p>
              </div>
            </div>
            <div className="af-photo-box">
              {student.photoURL ? (
                <img
                  src={student.photoURL}
                  alt="Student"
                  className="af-photo-img"
                />
              ) : (
                <div className="af-photo-placeholder">
                  <span>Student</span>
                  <span>Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="af-title-bar">
            DIGITAL STUDENT ADMISSION FORM
          </div>

          {/* Admission Number & Date Strip */}
          <div className="af-strip">
            <div className="af-strip-item">
              <span className="af-strip-label">Admission No.</span>
              <span className="af-strip-value">{r.admissionNo}</span>
            </div>
            <div className="af-strip-item">
              <span className="af-strip-label">Admission Date</span>
              <span className="af-strip-value">
                {formatDate(r.admissionDate)}
              </span>
            </div>
            <div className="af-strip-item">
              <span className="af-strip-label">Class Applied</span>
              <span className="af-strip-value">{r.classApplied}</span>
            </div>
          </div>

          {/* Section A: Admission Details */}
          <FormSection number={1} title="ADMISSION DETAILS">
            <FieldBox label="Admission Number" value={r.admissionNo} />
            <FieldBox label="Admission Date" value={formatDate(r.admissionDate)} />
            <FieldBox label="Class Applied" value={r.classApplied} />
            <FieldBox label="Section" value={r.section} />
            <FieldBox label="Medium" value={r.medium} />
            <FieldBox label="Academic Year" value={r.academicYearName} />
            <FieldBox label="Second Language" value={r.secondLang} />
            <FieldBox label="Admission Type" value={r.admissionType} />
          </FormSection>

          {/* Section B: Student Details */}
          <FormSection number={2} title="STUDENT DETAILS">
            <FieldBox label="Student Name" value={r.name} />
            <FieldBox label="Gender" value={r.gender} />
            <FieldBox label="Date of Birth" value={formatDate(r.dob)} />
            <FieldBox label="Aadhaar Number" value={r.aadhaar} />
            <FieldBox label="Blood Group" value={r.bloodGroup} />
            <FieldBox label="EMIS / Child ID" value={r.emis} />
            <FieldBox label="Nationality" value={r.nationality} />
            <FieldBox label="Mother Tongue" value={r.motherTongue} />
            <FieldBox label="Category" value={r.category} />
          </FormSection>

          {/* Section C: Parent/Guardian Details */}
          <FormSection number={3} title="PARENT / GUARDIAN DETAILS">
            <FieldBox label="Father Name" value={r.fatherName} />
            <FieldBox label="Father Mobile" value={r.fatherMobile} />
            <FieldBox label="Father Occupation" value={r.fatherOcc} />
            <FieldBox label="Mother Name" value={r.motherName} />
            <FieldBox label="Mother Mobile" value={r.motherMobile} />
            <FieldBox label="Mother Occupation" value={r.motherOcc} />
            <FieldBox label="Guardian Name" value={r.guardianName} />
            <FieldBox label="Relation" value={r.guardianRelation} />
            <FieldBox label="Emergency Number" value={r.emergencyPhone} />
          </FormSection>

          {/* Section D: Address Details */}
          <FormSection number={4} title="ADDRESS DETAILS" cols={2}>
            <FieldBox
              label="House / Street"
              value={r.addressLine || "—"}
              wide
            />
            <FieldBox label="Village / Area" value={r.village} />
            <FieldBox label="Mandal" value={r.mandal} />
            <FieldBox label="District" value={r.district} />
            <FieldBox label="PIN Code" value={r.pincode} />
          </FormSection>

          {/* Section E: Previous School, Transport, Fee */}
          <FormSection number={5} title="PREVIOUS SCHOOL, TRANSPORT & FEE">
            <FieldBox label="Previous School" value={r.prevSchool} />
            <FieldBox label="Last Studied Class" value={r.lastClass} />
            <FieldBox label="TC Number" value={r.tcNo} />
            <FieldBox label="Transport Required" value={r.transportRequired} />
            <FieldBox label="Route / Village" value={r.routeName} />
            <FieldBox label="Pickup Point" value={r.pickupPoint} />
            <FieldBox label="Fee Plan" value={r.feePlan} />
            <FieldBox label="Fee Types Assigned" value={r.feeTypes} wide />
            <FieldBox label="Total Committed Fee" value={r.totalFee} />
            <FieldBox label="Concession" value={r.concession} />
          </FormSection>

          {/* Section F: Documents Checklist */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">6</span>
              <span>DOCUMENTS CHECKLIST</span>
            </div>
            <div className="af-checklist-grid">
              <ChecklistItem
                label="Birth Certificate"
                checked={hasDocument(student, ["birth"])}
              />
              <ChecklistItem
                label="Student Aadhaar"
                checked={
                  Boolean(r.aadhaar) ||
                  hasDocument(student, ["student aadhaar", "aadhaar"])
                }
              />
              <ChecklistItem
                label="Parent Aadhaar"
                checked={hasDocument(student, [
                  "parent aadhaar",
                  "father aadhaar",
                  "mother aadhaar",
                ])}
              />
              <ChecklistItem
                label="TC / Bonafide"
                checked={
                  Boolean(r.tcNo) ||
                  hasDocument(student, ["tc", "bonafide"])
                }
              />
              <ChecklistItem
                label="Previous Report Card"
                checked={hasDocument(student, ["report"])}
              />
              <ChecklistItem
                label="Passport Photos"
                checked={
                  Boolean(student.photoURL) ||
                  hasDocument(student, ["photo"])
                }
              />
              <ChecklistItem
                label="Caste / Income Certificate"
                checked={hasDocument(student, ["caste", "income"])}
              />
              <ChecklistItem
                label="Other Documents"
                checked={(student.documentURLs ?? []).length > 0}
              />
            </div>
          </div>

          {/* Section G: Declaration */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">7</span>
              <span>DECLARATION</span>
            </div>
            <div className="af-declaration-box">
              <p className="af-declaration-text">
                I, the parent/guardian of{" "}
                <strong>{r.name || "the above-named student"}</strong>, hereby
                declare that all the information provided in this admission form
                is true and correct to the best of my knowledge. I agree to abide
                by the rules and regulations of Sri Narayana High School,
                including the fee schedule, attendance policy, uniform rules,
                code of conduct, and transport safety instructions. I understand
                that any false information may lead to the cancellation of
                admission.
              </p>
            </div>
          </div>

          {/* Section H: Signatures */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">8</span>
              <span>SIGNATURES</span>
            </div>
            <div className="af-signatures">
              <SignatureLine title="Parent / Guardian Signature" />
              <SignatureLine title="Student Signature" />
              <SignatureLine title="Principal / Office Signature" />
            </div>
          </div>

          {/* Section I: Office Use Only */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">9</span>
              <span>OFFICE USE ONLY</span>
            </div>
            <div className="af-grid af-grid-3">
              <FieldBox label="Admission Status" value={r.admissionStatus} />
              <FieldBox label="Verified By" value={r.verifiedByName} />
              <FieldBox label="Created By" value={r.createdByName} />
              <FieldBox label="Student Login" value={r.studentLogin} />
              <FieldBox label="Parent Login" value={r.parentLogin} />
              <FieldBox
                label="Created Date"
                value={formatDateTime(student.createdAt)}
              />
              <FieldBox
                label="Last Updated"
                value={formatDateTime(student.updatedAt)}
              />
              <FieldBox label="Branch" value={r.branchName} />
              <FieldBox label="School ID" value={resolveValue(student.schoolId)} />
            </div>
          </div>

          {/* ERP ID Footer */}
          <div className="af-footer">
            <span className="af-footer-text">
              ERP ID: {student.id} &nbsp;|&nbsp; Printed on{" "}
              {printedAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              at{" "}
              {printedAt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== STYLES ==================== */}
      <style jsx>{`
        /* ---------- Page Root ---------- */
        .af-page-root {
          min-height: 100vh;
          background: #eef0f7;
          font-family: Arial, "Helvetica Neue", sans-serif;
          padding-bottom: 80px;
        }

        /* ---------- Loading ---------- */
        .af-loading {
          display: flex;
          min-height: 100vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: #eef0f7;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
        }
        .af-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #d7deeb;
          border-top-color: #3033a1;
          border-radius: 50%;
          animation: af-spin 0.7s linear infinite;
        }
        @keyframes af-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .af-error-text {
          color: #ed515d;
          font-size: 16px;
          font-weight: 700;
        }
        .af-back-btn {
          padding: 8px 18px;
          background: #3033a1;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .af-back-btn:hover {
          background: #272a86;
        }

        /* ---------- Action Bar ---------- */
        .af-action-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #ffffff;
          border-bottom: 1px solid #d7deeb;
          padding: 10px 24px;
          flex-wrap: wrap;
        }
        .af-action-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .af-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #d7deeb;
          border-radius: 8px;
          background: #fff;
          color: #1f2937;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .af-action-btn:hover {
          background: #f4f5fb;
          border-color: #c7d1ec;
        }
        .af-action-back {
          color: #3033a1;
          border-color: #d7deeb;
        }
        .af-action-print {
          background: #3033a1;
          color: #fff;
          border-color: #3033a1;
        }
        .af-action-print:hover {
          background: #272a86;
        }
        .af-action-download {
          background: #0d8f5b;
          color: #fff;
          border-color: #0d8f5b;
        }
        .af-action-download:hover {
          background: #0a7a4d;
        }

        /* ---------- A4 Wrapper ---------- */
        .af-a4-wrapper {
          display: flex;
          justify-content: center;
          padding: 32px 16px;
        }
        .af-a4-sheet {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
          padding: 14mm 12mm 8mm;
          color: #172033;
          line-height: 1.3;
          position: relative;
        }

        /* ---------- Header ---------- */
        .af-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border: 1.5px solid #1f2f8d;
          padding: 10px 14px;
        }
        .af-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }
        .af-logo {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .af-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .af-school-info {
          flex: 1;
          min-width: 0;
        }
        .af-school-name {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.03em;
          margin: 0 0 3px;
          color: #1f2f8d;
        }
        .af-school-address {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          margin: 1px 0;
        }
        .af-school-contact {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          margin: 2px 0 0;
        }
        .af-photo-box {
          width: 88px;
          height: 100px;
          flex-shrink: 0;
          border: 2px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .af-photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .af-photo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.2;
        }

        /* ---------- Title ---------- */
        .af-title-bar {
          background: #1f2f8d;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-align: center;
          padding: 8px 10px;
          margin: 10px 0;
        }

        /* ---------- Top Strip ---------- */
        .af-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }
        .af-strip-item {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e2e8f0;
          padding: 5px 8px;
          min-height: 32px;
        }
        .af-strip-label {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .af-strip-value {
          font-size: 12px;
          font-weight: 800;
          color: #111827;
        }

        /* ---------- Form Section ---------- */
        .af-section {
          border: 1px solid #d7deeb;
          margin-top: 8px;
          break-inside: avoid;
        }
        .af-section-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #eef2ff;
          border-bottom: 1px solid #d7deeb;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
          color: #1f2f8d;
          letter-spacing: 0.04em;
        }
        .af-section-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1f2f8d;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          flex-shrink: 0;
        }

        /* ---------- Grid ---------- */
        .af-grid {
          display: grid;
          gap: 6px;
          padding: 6px;
        }
        .af-grid-2 {
          grid-template-columns: repeat(2, 1fr);
        }
        .af-grid-3 {
          grid-template-columns: repeat(3, 1fr);
        }

        /* ---------- Field ---------- */
        .af-field {
          border: 1px solid #e2e8f0;
          padding: 5px 7px;
          min-height: 38px;
        }
        .af-field-wide {
          grid-column: span 2;
        }
        .af-label {
          display: block;
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 2px;
        }
        .af-value {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: #111827;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* ---------- Checklist ---------- */
        .af-checklist-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px 12px;
          padding: 8px 10px;
        }
        .af-check-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: default;
          font-size: 10px;
          font-weight: 700;
          color: #1f2937;
        }
        .af-check-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15px;
          height: 15px;
          border: 1.5px solid #475569;
          flex-shrink: 0;
          background: #fff;
        }
        .af-check-tick {
          font-size: 11px;
          font-weight: 900;
          color: #0d8f5b;
          line-height: 1;
        }
        .af-check-label {
          line-height: 1.2;
        }

        /* ---------- Declaration ---------- */
        .af-declaration-box {
          padding: 10px 12px;
        }
        .af-declaration-text {
          font-size: 10.5px;
          font-weight: 600;
          color: #334155;
          margin: 0;
          line-height: 1.6;
        }

        /* ---------- Signatures ---------- */
        .af-signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          padding: 14px 12px 10px;
        }
        .af-signature {
          text-align: center;
        }
        .af-signature-line {
          height: 1px;
          border-top: 1.5px solid #475569;
          margin-bottom: 6px;
        }
        .af-signature-title {
          font-size: 9.5px;
          font-weight: 800;
          color: #475569;
        }

        /* ---------- Office Use ---------- */
        .af-office-note {
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
          padding: 4px 10px 8px;
        }

        /* ---------- Footer ---------- */
        .af-footer {
          margin-top: 14px;
          padding-top: 6px;
          border-top: 1px solid #d7deeb;
          text-align: center;
        }
        .af-footer-text {
          font-size: 8px;
          font-weight: 600;
          color: #94a3b8;
        }

        /* =============== Print Styles =============== */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .af-page-root {
            background: #fff !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          .af-action-bar {
            display: none !important;
          }

          .af-a4-wrapper {
            padding: 0 !important;
            display: block !important;
          }

          .af-a4-sheet {
            width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .af-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .af-check-box {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-check-tick {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-section-heading {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-section-number {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-title-bar {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide non-form elements globally during print */
          nav,
          header,
          aside,
          .no-print {
            display: none !important;
          }
        }

        /* =============== Responsive =============== */
        @media (max-width: 900px) {
          .af-a4-sheet {
            width: 100%;
            min-height: auto;
            padding: 20px 14px;
            box-shadow: none;
          }
          .af-strip {
            grid-template-columns: 1fr;
          }
          .af-grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
          .af-checklist-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .af-signatures {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .af-school-name {
            font-size: 17px;
          }
          .af-photo-box {
            width: 70px;
            height: 80px;
          }
        }

        @media (max-width: 600px) {
          .af-grid-3,
          .af-grid-2 {
            grid-template-columns: 1fr;
          }
          .af-grid-3 {
            grid-template-columns: 1fr;
          }
          .af-field-wide {
            grid-column: span 1;
          }
          .af-header {
            flex-direction: column;
            align-items: stretch;
          }
          .af-header-left {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .af-photo-box {
            align-self: center;
          }
          .af-checklist-grid {
            grid-template-columns: 1fr 1fr;
          }
          .af-action-bar {
            flex-direction: column;
            align-items: stretch;
            padding: 10px 12px;
          }
          .af-action-right {
            justify-content: stretch;
          }
          .af-action-btn {
            flex: 1;
            justify-content: center;
          }
          .af-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
