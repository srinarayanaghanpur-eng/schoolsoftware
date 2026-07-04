"use client";

import { useState, useEffect } from "react";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";
import { Plus, X, Edit2, Trash2, Search, Upload, Camera, QrCode, Printer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { hasPermission } from "@sri-narayana/shared";
import { uploadFile, getStudentPhotoPath, getDocumentPath } from "@/lib/uploadService";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

interface FeeStructureItem {
  id?: string;
  className: string;
  heads: { name: string; amount: number }[];
  total: number;
}

interface Student {
  id: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  annualEnrollmentFee?: string;
  commitmentFee?: string;
  photoURL?: string;
  aadhaarNumber?: string;
  documentURLs?: { name: string; url: string }[];
  previousSchool?: { name: string; address: string; yearLeft: string } | null;
  siblingAdmissionNumbers?: string[];
  emergencyContact?: { name: string; phone: string; relation: string } | null;
  transportRouteId?: string;
  transportStopName?: string;
  transportFee?: number;
}

interface TransportRoute {
  id: string;
  name: string;
  stops: { name: string; fee: number }[];
}

const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

type ClassAgeGroup = "toddler" | "early-years" | "primary" | "upper-primary" | "pre-teen" | "teen";
type ChildIconVariant = "baby" | "tiny" | "kindergarten" | "primary" | "senior-primary" | "preteen" | "teen";

type StudentClassCardConfig = {
  id: string;
  label: string;
  ageGroup: ClassAgeGroup;
  icon: ChildIconVariant;
  availableSections: string[];
  accent: {
    border: string;
    activeBorder: string;
    background: string;
    activeBackground: string;
    text: string;
    ring: string;
    select: string;
  };
};

const CLASS_SELECTOR_CLASSES: StudentClassCardConfig[] = [
  {
    id: "Nur",
    label: "Nursery",
    ageGroup: "toddler",
    icon: "baby",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffd8c7]",
      activeBorder: "border-[#f08a65]",
      background: "bg-[#fff8f3]",
      activeBackground: "bg-[#fff0e8]",
      text: "text-[#b75f37]",
      ring: "shadow-[0_14px_34px_rgba(240,138,101,0.20)]",
      select: "focus:border-[#f08a65] focus:ring-[#f08a65]/20"
    }
  },
  {
    id: "LKG",
    label: "LKG",
    ageGroup: "early-years",
    icon: "tiny",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffe2a9]",
      activeBorder: "border-[#e5a52f]",
      background: "bg-[#fffaf0]",
      activeBackground: "bg-[#fff3d9]",
      text: "text-[#a66c09]",
      ring: "shadow-[0_14px_34px_rgba(229,165,47,0.20)]",
      select: "focus:border-[#e5a52f] focus:ring-[#e5a52f]/20"
    }
  },
  {
    id: "UKG",
    label: "UKG",
    ageGroup: "early-years",
    icon: "kindergarten",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#cdeec9]",
      activeBorder: "border-[#55ad62]",
      background: "bg-[#f6fff5]",
      activeBackground: "bg-[#ebfae8]",
      text: "text-[#2e7d39]",
      ring: "shadow-[0_14px_34px_rgba(85,173,98,0.20)]",
      select: "focus:border-[#55ad62] focus:ring-[#55ad62]/20"
    }
  },
  {
    id: "1",
    label: "Class 1",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#c8e6ff]",
      activeBorder: "border-[#4b96d8]",
      background: "bg-[#f4fbff]",
      activeBackground: "bg-[#eaf6ff]",
      text: "text-[#246ba7]",
      ring: "shadow-[0_14px_34px_rgba(75,150,216,0.20)]",
      select: "focus:border-[#4b96d8] focus:ring-[#4b96d8]/20"
    }
  },
  {
    id: "2",
    label: "Class 2",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#d8d9ff]",
      activeBorder: "border-[#7370dc]",
      background: "bg-[#f8f8ff]",
      activeBackground: "bg-[#eeeeff]",
      text: "text-[#4f4bae]",
      ring: "shadow-[0_14px_34px_rgba(115,112,220,0.20)]",
      select: "focus:border-[#7370dc] focus:ring-[#7370dc]/20"
    }
  },
  {
    id: "3",
    label: "Class 3",
    ageGroup: "primary",
    icon: "primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#f2cfef]",
      activeBorder: "border-[#c765bb]",
      background: "bg-[#fff6fe]",
      activeBackground: "bg-[#faeafa]",
      text: "text-[#96398e]",
      ring: "shadow-[0_14px_34px_rgba(199,101,187,0.20)]",
      select: "focus:border-[#c765bb] focus:ring-[#c765bb]/20"
    }
  },
  {
    id: "4",
    label: "Class 4",
    ageGroup: "upper-primary",
    icon: "senior-primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#c8eadf]",
      activeBorder: "border-[#36a988]",
      background: "bg-[#f4fffb]",
      activeBackground: "bg-[#e7faf3]",
      text: "text-[#18765e]",
      ring: "shadow-[0_14px_34px_rgba(54,169,136,0.20)]",
      select: "focus:border-[#36a988] focus:ring-[#36a988]/20"
    }
  },
  {
    id: "5",
    label: "Class 5",
    ageGroup: "upper-primary",
    icon: "senior-primary",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#fed4dc]",
      activeBorder: "border-[#e65b73]",
      background: "bg-[#fff7f8]",
      activeBackground: "bg-[#ffeef2]",
      text: "text-[#b33b51]",
      ring: "shadow-[0_14px_34px_rgba(230,91,115,0.20)]",
      select: "focus:border-[#e65b73] focus:ring-[#e65b73]/20"
    }
  },
  {
    id: "6",
    label: "Class 6",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#cde3ff]",
      activeBorder: "border-[#407fd2]",
      background: "bg-[#f6faff]",
      activeBackground: "bg-[#eaf3ff]",
      text: "text-[#245ca4]",
      ring: "shadow-[0_14px_34px_rgba(64,127,210,0.20)]",
      select: "focus:border-[#407fd2] focus:ring-[#407fd2]/20"
    }
  },
  {
    id: "7",
    label: "Class 7",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#d7edd2]",
      activeBorder: "border-[#70aa4e]",
      background: "bg-[#f7fff3]",
      activeBackground: "bg-[#edf9e8]",
      text: "text-[#4f7f2f]",
      ring: "shadow-[0_14px_34px_rgba(112,170,78,0.20)]",
      select: "focus:border-[#70aa4e] focus:ring-[#70aa4e]/20"
    }
  },
  {
    id: "8",
    label: "Class 8",
    ageGroup: "pre-teen",
    icon: "preteen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#e0d5ff]",
      activeBorder: "border-[#8a69de]",
      background: "bg-[#faf7ff]",
      activeBackground: "bg-[#f1ecff]",
      text: "text-[#6045b1]",
      ring: "shadow-[0_14px_34px_rgba(138,105,222,0.20)]",
      select: "focus:border-[#8a69de] focus:ring-[#8a69de]/20"
    }
  },
  {
    id: "9",
    label: "Class 9",
    ageGroup: "teen",
    icon: "teen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#bfe7ec]",
      activeBorder: "border-[#2696a6]",
      background: "bg-[#f3fdff]",
      activeBackground: "bg-[#e4f8fb]",
      text: "text-[#167384]",
      ring: "shadow-[0_14px_34px_rgba(38,150,166,0.20)]",
      select: "focus:border-[#2696a6] focus:ring-[#2696a6]/20"
    }
  },
  {
    id: "10",
    label: "Class 10",
    ageGroup: "teen",
    icon: "teen",
    availableSections: SECTION_OPTIONS,
    accent: {
      border: "border-[#ffd0b9]",
      activeBorder: "border-[#df7144]",
      background: "bg-[#fff7f2]",
      activeBackground: "bg-[#ffede3]",
      text: "text-[#a64d26]",
      ring: "shadow-[0_14px_34px_rgba(223,113,68,0.20)]",
      select: "focus:border-[#df7144] focus:ring-[#df7144]/20"
    }
  }
];

const CLASS_OPTIONS = CLASS_SELECTOR_CLASSES.map((classItem) => classItem.id);
const CLASS_SELECTOR_ROW_ONE = CLASS_SELECTOR_CLASSES.slice(0, 8);
const CLASS_SELECTOR_ROW_TWO = CLASS_SELECTOR_CLASSES.slice(8);

const CLASS_LABELS = CLASS_SELECTOR_CLASSES.reduce<Record<string, string>>((labels, classItem) => {
  labels[classItem.id] = classItem.label;
  return labels;
}, {});

const CHILD_ICON_STYLES: Record<ChildIconVariant, {
  headY: number;
  headRadius: number;
  bodyTop: number;
  bodyHeight: number;
  bodyWidth: number;
  shirt: string;
  bottom: string;
  hair: string;
  bag?: string;
  tie?: string;
}> = {
  baby: {
    headY: 31,
    headRadius: 16,
    bodyTop: 48,
    bodyHeight: 25,
    bodyWidth: 30,
    shirt: "#ffb487",
    bottom: "#7aa7ff",
    hair: "#5b3b2d"
  },
  tiny: {
    headY: 29,
    headRadius: 15,
    bodyTop: 47,
    bodyHeight: 29,
    bodyWidth: 32,
    shirt: "#ffd166",
    bottom: "#6fcf97",
    hair: "#3f2b23"
  },
  kindergarten: {
    headY: 28,
    headRadius: 15,
    bodyTop: 46,
    bodyHeight: 31,
    bodyWidth: 34,
    shirt: "#7dd3fc",
    bottom: "#a78bfa",
    hair: "#49372f"
  },
  primary: {
    headY: 26,
    headRadius: 14,
    bodyTop: 44,
    bodyHeight: 35,
    bodyWidth: 36,
    shirt: "#93c5fd",
    bottom: "#f9a8d4",
    hair: "#34251f",
    bag: "#f97316"
  },
  "senior-primary": {
    headY: 25,
    headRadius: 13,
    bodyTop: 43,
    bodyHeight: 38,
    bodyWidth: 36,
    shirt: "#86efac",
    bottom: "#60a5fa",
    hair: "#2d2522",
    bag: "#8b5cf6"
  },
  preteen: {
    headY: 24,
    headRadius: 13,
    bodyTop: 42,
    bodyHeight: 40,
    bodyWidth: 37,
    shirt: "#67e8f9",
    bottom: "#818cf8",
    hair: "#2a211f",
    bag: "#14b8a6",
    tie: "#2563eb"
  },
  teen: {
    headY: 23,
    headRadius: 12,
    bodyTop: 41,
    bodyHeight: 43,
    bodyWidth: 38,
    shirt: "#fca5a5",
    bottom: "#475569",
    hair: "#211816",
    bag: "#0ea5e9",
    tie: "#dc2626"
  }
};

function defaultClassSections() {
  return CLASS_SELECTOR_CLASSES.reduce<Record<string, string>>((sections, classItem) => {
    sections[classItem.id] = classItem.availableSections[0] ?? "A";
    return sections;
  }, {});
}

// Fallback fees used when no fee structure exists in DB for a class
const FALLBACK_FEE_BY_CLASS: Record<string, number> = {
  Nur: 17000, LKG: 18000, UKG: 19000,
  "1": 20000, "2": 21000, "3": 22000,
  "4": 23000, "5": 24000, "6": 27000,
  "7": 28000, "8": 29000, "9": 30000, "10": 33000
};

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-full border-t border-[#edf0f7] pt-4 pb-2">
      <h4 className="text-sm font-bold uppercase tracking-wide text-[#3033a1]">{label}</h4>
    </div>
  );
}

function ChildClassIcon({ variant }: { variant: ChildIconVariant }) {
  const style = CHILD_ICON_STYLES[variant];
  const bodyLeft = 48 - style.bodyWidth / 2;
  const bodyRight = 48 + style.bodyWidth / 2;
  const bodyBottom = style.bodyTop + style.bodyHeight;
  const shortTop = style.bodyTop + style.bodyHeight * 0.52;
  const legTop = bodyBottom - 1;
  const legBottom = 86;

  return (
    <svg viewBox="0 0 96 96" className="h-14 w-14" role="img" aria-label="Student avatar">
      <ellipse cx="48" cy="88" rx="27" ry="4" fill="#dfe6f4" opacity="0.85" />
      {style.bag && (
        <path
          d={`M${bodyLeft - 5} ${style.bodyTop + 7} Q${bodyLeft - 10} ${style.bodyTop + 19} ${bodyLeft - 4} ${bodyBottom - 3} L${bodyLeft + 2} ${bodyBottom - 6} Q${bodyLeft - 1} ${style.bodyTop + 18} ${bodyLeft + 3} ${style.bodyTop + 9} Z`}
          fill={style.bag}
          opacity="0.82"
        />
      )}
      <path
        d={`M${bodyLeft + 2} ${style.bodyTop + 9} Q${bodyLeft - 10} ${style.bodyTop + 19} ${bodyLeft - 7} ${style.bodyTop + 32}`}
        fill="none"
        stroke="#f3c2a4"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M${bodyRight - 2} ${style.bodyTop + 9} Q${bodyRight + 10} ${style.bodyTop + 19} ${bodyRight + 7} ${style.bodyTop + 32}`}
        fill="none"
        stroke="#f3c2a4"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M${bodyLeft} ${style.bodyTop + 7} Q48 ${style.bodyTop - 2} ${bodyRight} ${style.bodyTop + 7} L${bodyRight - 4} ${shortTop} L${bodyLeft + 4} ${shortTop} Z`}
        fill={style.shirt}
      />
      {style.tie && <path d={`M47 ${style.bodyTop + 9} L52 ${style.bodyTop + 9} L50 ${shortTop - 2} L45 ${shortTop - 2} Z`} fill={style.tie} />}
      <path d={`M${bodyLeft + 4} ${shortTop} L${bodyRight - 4} ${shortTop} L${bodyRight - 1} ${bodyBottom} L${bodyLeft + 1} ${bodyBottom} Z`} fill={style.bottom} />
      <path d={`M40 ${legTop} L38 ${legBottom}`} stroke="#f3c2a4" strokeWidth="6" strokeLinecap="round" />
      <path d={`M56 ${legTop} L58 ${legBottom}`} stroke="#f3c2a4" strokeWidth="6" strokeLinecap="round" />
      <path d="M34 88 Q40 82 45 87" fill="none" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
      <path d="M52 87 Q58 82 64 88" fill="none" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy={style.headY} r={style.headRadius} fill="#f5c6a6" />
      <path
        d={`M${48 - style.headRadius} ${style.headY - 1} Q48 ${style.headY - style.headRadius - 11} ${48 + style.headRadius} ${style.headY - 1} Q57 ${style.headY - style.headRadius + 4} 48 ${style.headY - style.headRadius + 5} Q39 ${style.headY - style.headRadius + 4} ${48 - style.headRadius} ${style.headY - 1} Z`}
        fill={style.hair}
      />
      {variant === "baby" && (
        <>
          <circle cx="33" cy="32" r="6" fill={style.hair} />
          <circle cx="63" cy="32" r="6" fill={style.hair} />
        </>
      )}
      <circle cx="43" cy={style.headY + 2} r="1.8" fill="#273244" />
      <circle cx="53" cy={style.headY + 2} r="1.8" fill="#273244" />
      <path d={`M43 ${style.headY + 9} Q48 ${style.headY + 13} 54 ${style.headY + 9}`} fill="none" stroke="#9f5a4a" strokeWidth="2.2" strokeLinecap="round" />
      {variant === "teen" && <path d="M37 15 Q48 4 60 16" fill="none" stroke={style.hair} strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

function StudentClassCard({
  classItem,
  isSelected,
  selectedSection,
  onSelectClass,
  onSelectSection
}: {
  classItem: StudentClassCardConfig;
  isSelected: boolean;
  selectedSection: string;
  onSelectClass: (classId: string) => void;
  onSelectSection: (classId: string, section: string) => void;
}) {
  return (
    <div
      className={`min-h-[148px] rounded-2xl border p-2.5 transition ${classItem.accent.border} ${classItem.accent.background} ${
        isSelected ? `${classItem.accent.activeBorder} ${classItem.accent.activeBackground} ${classItem.accent.ring}` : "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,33,54,0.10)]"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectClass(classItem.id)}
        aria-pressed={isSelected}
        className="flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center"
      >
        <span className={`text-[13px] font-extrabold leading-tight ${isSelected ? classItem.accent.text : "text-[#303247]"}`}>
          {classItem.label}
        </span>
        <span className={`grid h-[58px] w-[58px] place-items-center rounded-2xl bg-white/80 ${isSelected ? "ring-2 ring-white" : ""}`}>
          <ChildClassIcon variant={classItem.icon} />
        </span>
      </button>
      <label className="sr-only" htmlFor={`class-section-${classItem.id}`}>
        {classItem.label} section
      </label>
      <select
        id={`class-section-${classItem.id}`}
        value={selectedSection}
        onChange={(event) => onSelectSection(classItem.id, event.target.value)}
        className={`mt-2 h-9 w-full rounded-xl border border-white/80 bg-white px-2 text-xs font-bold text-[#303247] outline-none transition focus:ring-2 ${classItem.accent.select}`}
      >
        {classItem.availableSections.map((section) => (
          <option key={section} value={section}>
            Section {section}
          </option>
        ))}
      </select>
    </div>
  );
}

function StudentClassSelector({
  selectedClass,
  sectionByClass,
  onSelectClass,
  onSelectSection
}: {
  selectedClass: string;
  sectionByClass: Record<string, string>;
  onSelectClass: (classId: string) => void;
  onSelectSection: (classId: string, section: string) => void;
}) {
  const renderCard = (classItem: StudentClassCardConfig) => (
    <StudentClassCard
      key={classItem.id}
      classItem={classItem}
      isSelected={selectedClass === classItem.id}
      selectedSection={sectionByClass[classItem.id] ?? classItem.availableSections[0] ?? "A"}
      onSelectClass={onSelectClass}
      onSelectSection={onSelectSection}
    />
  );

  return (
    <div className="space-y-3">
      <div className="hidden gap-3 xl:grid xl:grid-cols-8">
        {CLASS_SELECTOR_ROW_ONE.map(renderCard)}
      </div>
      <div className="hidden gap-3 xl:grid xl:grid-cols-8">
        {CLASS_SELECTOR_ROW_TWO.map(renderCard)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:hidden">
        {CLASS_SELECTOR_CLASSES.map(renderCard)}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { role } = useAdminSession();
  const { activeYear } = useAcademicYears();
  const canCreateStudent = Boolean(role && hasPermission(role, "students.create"));
  const canEditStudent = Boolean(role && hasPermission(role, "students.edit"));
  const canDeleteStudent = Boolean(role && hasPermission(role, "students.delete"));
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("1");
  const [sectionFilter, setSectionFilter] = useState("A");
  const [sectionByClass, setSectionByClass] = useState<Record<string, string>>(() => defaultClassSections());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);

  const academicFeeForClass = (className: string) => {
    const found = feeStructures.find((fs) => fs.className === className);
    return String(found?.total ?? FALLBACK_FEE_BY_CLASS[className] ?? 0);
  };

  const selectClassFilter = (classId: string) => {
    setClassFilter(classId);
    setSectionFilter(sectionByClass[classId] ?? "A");
  };

  const selectClassSection = (classId: string, section: string) => {
    setSectionByClass((prev) => ({ ...prev, [classId]: section }));
    setClassFilter(classId);
    setSectionFilter(section);
  };

  const [formData, setFormData] = useState({
    admissionNumber: "",
    studentName: "",
    class: "1",
    section: "A",
    gender: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    address: "",
    photoURL: "",
    aadhaarNumber: "",
    documentURLs: [] as { name: string; url: string }[],
    previousSchoolName: "",
    previousSchoolAddress: "",
    previousSchoolYearLeft: "",
    siblingAdmissionNumbers: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    transportRouteId: "",
    transportStopName: "",
    transportFee: "0",
    annualEnrollmentFee: academicFeeForClass("1"),
    commitmentFee: "0"
  });

  // Reload whenever the class/section/year/page-size selection changes, so the
  // list always shows exactly the selected section (never a mixed list).
  useEffect(() => {
    fetchStudents();
    fetchSectionCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear?.id, classFilter, sectionFilter, pageSize]);
  useEffect(() => {
    fetchTransportRoutes();
  }, []);
  useRefreshOnFocus(() => fetchStudents());

  useEffect(() => {
    if (activeYear?.id) {
      fetchFeeStructures(activeYear.id);
    }
  }, [activeYear?.id]);

  const fetchFeeStructures = async (academicYearId: string) => {
    setFeeLoading(true);
    try {
      const data = await adminApiRequest<{ ok?: boolean; structures?: FeeStructureItem[] }>(
        `/api/admin/fee-structures?academicYearId=${academicYearId}`
      );
      if (data.structures) setFeeStructures(data.structures);
    } catch { /* silently ignore */ }
    finally { setFeeLoading(false); }
  };

  const fetchTransportRoutes = async () => {
    try {
      const data = await adminApiRequest<{ success?: boolean; data?: TransportRoute[] }>(
        "/api/admin/transport/routes"
      );
      if (data.data) setTransportRoutes(data.data);
    } catch { /* silently ignore */ }
  };

  const buildStudentQuery = (cursor?: string | null) => {
    const params = new URLSearchParams();
    params.set("pageSize", String(pageSize));
    if (activeYear?.id) params.set("academicYearId", activeYear.id);
    if (classFilter) params.set("class", classFilter);
    if (sectionFilter) params.set("section", sectionFilter);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  };

  // Aggregate count for the selected scope — 1 read per 1000 students instead
  // of downloading them all just to show a total.
  const fetchSectionCount = async () => {
    try {
      const params = new URLSearchParams({ count: "1" });
      if (activeYear?.id) params.set("academicYearId", activeYear.id);
      if (classFilter) params.set("class", classFilter);
      if (sectionFilter) params.set("section", sectionFilter);
      const data = await adminApiRequest<{ success?: boolean; count?: number }>(
        `/api/admin/students?${params.toString()}`
      );
      setSectionCount(typeof data.count === "number" ? data.count : null);
    } catch {
      setSectionCount(null);
    }
  };

  const fetchStudents = async (options: { append?: boolean; cursor?: string | null } = {}) => {
    try {
      setLoading(true);
      const data = await adminApiRequest<{ success?: boolean; data: Student[]; nextCursor?: string | null; hasMore?: boolean }>(
        `/api/admin/students?${buildStudentQuery(options.cursor)}`
      );
      setStudents((prev) => options.append ? [...prev, ...(data.data ?? [])] : data.data ?? []);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setError(err instanceof AdminApiError ? err.message : "Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const isEditing = Boolean(editingId);
    if (isEditing ? !canEditStudent : !canCreateStudent) {
      setError(isEditing ? "Your role cannot edit students." : "Your role cannot add students.");
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        admissionNumber: formData.admissionNumber,
        studentName: formData.studentName,
        class: formData.class,
        classId: formData.class,
        section: formData.section,
        sectionId: formData.section,
        academicYearId: activeYear?.id || "",
        gender: formData.gender,
        fatherName: formData.fatherName,
        fatherPhone: formData.fatherPhone,
        motherName: formData.motherName,
        motherPhone: formData.motherPhone,
        dateOfBirth: formData.dateOfBirth,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        photoURL: formData.photoURL,
        aadhaarNumber: formData.aadhaarNumber,
        documentURLs: formData.documentURLs,
        siblingAdmissionNumbers: formData.siblingAdmissionNumbers
          ? formData.siblingAdmissionNumbers.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        annualEnrollmentFee: Number(formData.annualEnrollmentFee || 0),
        commitmentFee: Number(formData.commitmentFee || 0)
      };

      if (formData.previousSchoolName) {
        payload.previousSchool = {
          name: formData.previousSchoolName,
          address: formData.previousSchoolAddress || "",
          yearLeft: formData.previousSchoolYearLeft || ""
        };
      }

      if (formData.emergencyContactName) {
        payload.emergencyContact = {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone || "",
          relation: formData.emergencyContactRelation || ""
        };
      }

      if (formData.transportRouteId) {
        payload.transportRouteId = formData.transportRouteId;
        payload.transportStopName = formData.transportStopName;
        payload.transportFee = Number(formData.transportFee || 0);
      }

      await adminApiRequest(
        isEditing ? `/api/admin/students/${editingId}` : "/api/admin/students",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        }
      );

      setSuccess(isEditing ? "Student updated successfully!" : "Student added successfully!");
      resetForm();
      setShowForm(false);
      fetchStudents();
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : isEditing
            ? "Failed to update student"
            : "Failed to add student"
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Academic fee is locked to the selected class per the official fee structure.
      ...(name === "class" ? { annualEnrollmentFee: academicFeeForClass(value) } : {})
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(
        file,
        getStudentPhotoPath(formData.admissionNumber || "new", file.name)
      );
      setFormData((prev) => ({ ...prev, photoURL: url }));
    } catch {
      setError("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(
        file,
        getDocumentPath(formData.admissionNumber || "new", file.name)
      );
      setFormData((prev) => ({
        ...prev,
        documentURLs: [...prev.documentURLs, { name: file.name, url }]
      }));
    } catch {
      setError("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documentURLs: prev.documentURLs.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      admissionNumber: "",
      studentName: "",
      class: "1",
      section: "A",
      gender: "",
      fatherName: "",
      fatherPhone: "",
      motherName: "",
      motherPhone: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      address: "",
      photoURL: "",
      aadhaarNumber: "",
      documentURLs: [],
      previousSchoolName: "",
      previousSchoolAddress: "",
      previousSchoolYearLeft: "",
      siblingAdmissionNumbers: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
      transportRouteId: "",
      transportStopName: "",
      transportFee: "0",
      annualEnrollmentFee: academicFeeForClass("1"),
      commitmentFee: "0"
    });
  };

  const openAddForm = () => {
    setError("");
    setSuccess("");
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (student: Student) => {
    setError("");
    setSuccess("");
    setEditingId(student.id);
    const prevSchool = student.previousSchool as { name?: string; address?: string; yearLeft?: string } | null | undefined;
    const emergContact = student.emergencyContact as { name?: string; phone?: string; relation?: string } | null | undefined;
    setFormData({
      admissionNumber: student.admissionNumber,
      studentName: student.studentName ?? "",
      class: student.class,
      section: student.section ?? "A",
      gender: "",
      fatherName: student.fatherName ?? "",
      fatherPhone: "",
      motherName: student.motherName ?? "",
      motherPhone: "",
      dateOfBirth: typeof student.dateOfBirth === "string" ? student.dateOfBirth.slice(0, 10) : "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      address: student.address ?? "",
      photoURL: student.photoURL ?? "",
      aadhaarNumber: student.aadhaarNumber ?? "",
      documentURLs: (student.documentURLs as { name: string; url: string }[]) ?? [],
      previousSchoolName: prevSchool?.name ?? "",
      previousSchoolAddress: prevSchool?.address ?? "",
      previousSchoolYearLeft: prevSchool?.yearLeft ?? "",
      siblingAdmissionNumbers: (student.siblingAdmissionNumbers ?? []).join(", "),
      emergencyContactName: emergContact?.name ?? "",
      emergencyContactPhone: emergContact?.phone ?? "",
      emergencyContactRelation: emergContact?.relation ?? "",
      transportRouteId: student.transportRouteId ?? "",
      transportStopName: student.transportStopName ?? "",
      transportFee: String(student.transportFee ?? "0"),
      annualEnrollmentFee: academicFeeForClass(student.class),
      commitmentFee: String(student.commitmentFee ?? "0")
    });
    setShowForm(true);
  };

  const handleDelete = async (student: Student) => {
    if (!canDeleteStudent) return;
    if (!window.confirm(`Delete ${student.studentName} (${student.admissionNumber})? This cannot be undone.`)) return;
    setError("");
    setSuccess("");
    try {
      await adminApiRequest(`/api/admin/students/${student.id}`, { method: "DELETE" });
      setSuccess("Student deleted.");
      fetchStudents();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete student");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const encodeQrPayload = (student: Student) => {
    const payload = {
      name: student.studentName,
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      phone: student.phone || "",
      address: student.address || ""
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const qrContent = (student: Student) => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/student-qr?d=${encodeQrPayload(student)}`;
  };

  const [qrCanvas, setQrCanvas] = useState<Record<string, string>>({});

  useEffect(() => {
    const generateQrs = async () => {
      const QRCode = (await import("qrcode")).default;
      const results: Record<string, string> = {};
      for (const student of students.slice(0, 50)) {
        try {
          results[student.id] = await QRCode.toDataURL(qrContent(student), {
            width: 160,
            margin: 1,
            color: { dark: "#1b1d32", light: "#ffffff" }
          });
        } catch { /* skip */ }
      }
      setQrCanvas(results);
    };
    generateQrs();
  }, [students]);

  const [printStudent, setPrintStudent] = useState<Student | null>(null);

  return (
    <>
      <PageHeader
        title="Students"
        description="Manage student records, fee commitments, and class sections."
        action={
          canCreateStudent ? (
            <button onClick={() => (showForm ? closeForm() : openAddForm())} className="btn-primary">
              <Plus size={18} />
              Add Student
            </button>
          ) : null
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {showForm && (
          <div className="card p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#1f2136]">{editingId ? "Edit Student" : "Add New Student"}</h3>
              <button onClick={closeForm} className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]">
                <X size={20} />
              </button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] p-4 text-sm font-semibold text-[#c83f4d]">{error}</div>}
            {success && <div className="mb-4 rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] p-4 text-sm font-semibold text-[#0f8d52]">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* ---- Basic Information ---- */}
                <SectionDivider label="Basic Information" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Admission Number *</label>
                  <input
                    type="text"
                    name="admissionNumber"
                    value={formData.admissionNumber}
                    readOnly={Boolean(editingId)}
                    onChange={handleChange}
                    required
                    className={`field mt-1 ${editingId ? "cursor-not-allowed bg-[#f4f5fb] text-[#5a6488]" : ""}`}
                  />
                  <p className="mt-1 text-xs font-medium text-[#7d86a8]">{editingId ? "Admission number cannot be changed." : "Enter a unique admission number."}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Student Name *</label>
                  <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required placeholder="Full name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Class *</label>
                  <select name="class" value={formData.class} onChange={handleChange} required className="field mt-1">
                    {CLASS_OPTIONS.map((cls) => <option key={cls} value={cls}>{CLASS_LABELS[cls] ?? cls}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Section *</label>
                  <select name="section" value={formData.section} onChange={handleChange} required className="field mt-1">
                    {SECTION_OPTIONS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="field mt-1">
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Date of Birth</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="field mt-1" />
                </div>

                {/* ---- Parent / Guardian Details ---- */}
                <SectionDivider label="Parent / Guardian Details" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Father Name</label>
                  <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} placeholder="Father's name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Father Phone</label>
                  <input type="tel" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Mother Name</label>
                  <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} placeholder="Mother's name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Mother Phone</label>
                  <input type="tel" name="motherPhone" value={formData.motherPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Phone (Primary Contact)</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">Address</label>
                  <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Street address" rows={2} className="field mt-1" />
                </div>

                {/* ---- Emergency Contact ---- */}
                <SectionDivider label="Emergency Contact" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Contact Name</label>
                  <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} placeholder="Emergency contact name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Contact Phone</label>
                  <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Relation</label>
                  <input type="text" name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} placeholder="e.g. uncle, grandparent" className="field mt-1" />
                </div>

                {/* ---- Photo & Documents ---- */}
                <SectionDivider label="Photo & Documents" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Student Photo</label>
                  <div className="mt-1 flex items-center gap-3">
                    {formData.photoURL ? (
                      <div className="relative">
                        <img src={formData.photoURL} alt="Student" className="h-20 w-20 rounded-xl object-cover border border-[#edf0f7]" />
                        <button type="button" onClick={() => setFormData((prev) => ({ ...prev, photoURL: "" }))} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-[#ed515d] text-white text-xs">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-[#d0d5e8] bg-[#f7f8fd]">
                        <Camera size={24} className="text-[#9aa4c4]" />
                      </div>
                    )}
                    <label className="cursor-pointer rounded-lg bg-[#eef0ff] px-3 py-2 text-xs font-semibold text-[#3033a1] hover:bg-[#e3e5ff]">
                      <Upload size={14} className="inline mr-1" />
                      {uploading ? "Uploading..." : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Aadhaar Number</label>
                  <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} placeholder="12-digit Aadhaar" maxLength={12} className="field mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">Documents</label>
                  <div className="mt-1 space-y-2">
                    {formData.documentURLs.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-[#edf0f7] bg-[#fafbff] px-3 py-2">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#3033a1] hover:underline truncate">{doc.name}</a>
                        <button type="button" onClick={() => removeDocument(i)} className="ml-2 text-[#ed515d] hover:text-[#c83f4d]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#d0d5e8] px-3 py-2 text-xs font-semibold text-[#7d86a8] hover:border-[#3033a1] hover:text-[#3033a1]">
                      <Upload size={14} />
                      {uploading ? "Uploading..." : "Upload Document"}
                      <input type="file" onChange={handleDocumentUpload} className="hidden" disabled={uploading} />
                    </label>
                  </div>
                </div>

                {/* ---- Previous School Details ---- */}
                <SectionDivider label="Previous School Details" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Previous School Name</label>
                  <input type="text" name="previousSchoolName" value={formData.previousSchoolName} onChange={handleChange} placeholder="School name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Year Left</label>
                  <input type="text" name="previousSchoolYearLeft" value={formData.previousSchoolYearLeft} onChange={handleChange} placeholder="e.g. 2025-26" className="field mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">Previous School Address</label>
                  <input type="text" name="previousSchoolAddress" value={formData.previousSchoolAddress} onChange={handleChange} placeholder="School address" className="field mt-1" />
                </div>

                {/* ---- Sibling / Family Group ---- */}
                <SectionDivider label="Sibling / Family Group" />

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">Sibling Admission Numbers</label>
                  <input type="text" name="siblingAdmissionNumbers" value={formData.siblingAdmissionNumbers} onChange={handleChange} placeholder="Comma-separated admission numbers, e.g. 1001, 1005" className="field mt-1" />
                  <p className="mt-1 text-xs font-medium text-[#7d86a8]">Enter admission numbers of siblings separated by commas.</p>
                </div>

                {/* ---- Transport ---- */}
                <SectionDivider label="Transport" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Transport Route</label>
                  <select name="transportRouteId" value={formData.transportRouteId} onChange={handleChange} className="field mt-1">
                    <option value="">No transport</option>
                    {transportRoutes.map((route) => (
                      <option key={route.id} value={route.id}>{route.name}</option>
                    ))}
                  </select>
                </div>

                {formData.transportRouteId && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Stop</label>
                      <select name="transportStopName" value={formData.transportStopName} onChange={handleChange} className="field mt-1">
                        <option value="">Select stop</option>
                        {transportRoutes
                          .find((r) => r.id === formData.transportRouteId)
                          ?.stops.map((stop) => (
                            <option key={stop.name} value={stop.name}>
                              {stop.name} (₹{stop.fee.toLocaleString("en-IN")})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Transport Fee</label>
                      <input type="number" min="0" name="transportFee" value={formData.transportFee} onChange={handleChange} placeholder="₹0" className="field mt-1" />
                    </div>
                  </>
                )}

                {/* ---- Fee Details ---- */}
                <SectionDivider label="Fee Details" />

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Academic Fee (Annual)</label>
                  <input
                    type="text"
                    name="annualEnrollmentFee"
                    value={`₹${Number(formData.annualEnrollmentFee || 0).toLocaleString("en-IN")}`}
                    readOnly
                    className="field mt-1 cursor-not-allowed bg-[#f4f5fb] font-semibold text-[#5a6488]"
                  />
                  {(() => {
                    const fs = feeStructures.find((s) => s.className === formData.class);
                    if (fs) {
                      return (
                        <p className="mt-1 text-xs font-medium text-[#7d86a8]">
                          {fs.heads.map((h) => `${h.name}: ₹${h.amount.toLocaleString("en-IN")}`).join(" · ")}
                        </p>
                      );
                    }
                    return (
                      <p className="mt-1 text-xs font-medium text-[#7d86a8]">
                        Auto-set from {CLASS_LABELS[formData.class] ?? formData.class} fee structure{feeLoading ? " (loading...)" : " (fallback)"}
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Commitment Fee</label>
                  <input type="number" min="0" name="commitmentFee" value={formData.commitmentFee} onChange={handleChange} placeholder="₹0" className="field mt-1" />
                </div>

              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="btn-primary">{editingId ? "Save Changes" : "Add Student"}</button>
                <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <StudentClassSelector
          selectedClass={classFilter}
          sectionByClass={sectionByClass}
          onSelectClass={selectClassFilter}
          onSelectSection={selectClassSection}
        />

        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
          <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8490b9]" />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchStudents();
              }}
                className="field pl-10"
            />
          </div>
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="field w-auto"
          aria-label="Students per page"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <button type="button" onClick={() => fetchStudents()} className="btn-secondary">
          Apply
        </button>
        </div>

        <div className="card overflow-hidden">
        {loading ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">Loading students...</div>
        ) : students.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">No students found</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="divide-y divide-[#edf0f7] md:hidden">
              {students.map((student) => (
                <li key={student.id} className="flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef0ff] text-xs font-extrabold text-[#3033a1]">
                    {student.class}{student.section}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#303247]">{student.studentName}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">Adm# {student.admissionNumber} · Class {student.class}-{student.section}</p>
                    {student.fatherName && <p className="mt-0.5 truncate text-xs font-medium text-[#7d86a8]">Father: {student.fatherName}</p>}
                    {student.phone && <a href={`tel:${student.phone}`} className="mt-0.5 inline-block text-xs font-semibold text-[#3033a1]">{student.phone}</a>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {qrCanvas[student.id] && (
                      <button onClick={() => setShowQrModal(student.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef6ff] text-[#3069a1]" aria-label="Show student details QR">
                        <QrCode size={16} />
                      </button>
                    )}
                    <Link href={`/admin/admission-form/${student.id}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0faf0] text-[#2d8659]" aria-label="Print admission form">
                      <Printer size={16} />
                    </Link>
                    {canEditStudent && (
                      <button onClick={() => openEditForm(student)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eeefff] text-[#3033a1]" aria-label="Edit student">
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDeleteStudent && (
                      <button onClick={() => handleDelete(student)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d]" aria-label="Delete student">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Admission No.</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Father Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Phone</th>
                    <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                    <tr key={student.id} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                      <td className="px-6 py-4 text-sm font-bold text-[#303247]">{student.admissionNumber}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#303247]">{student.studentName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.class}-{student.section}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.fatherName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.phone}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {qrCanvas[student.id] && (
                          <button onClick={() => setShowQrModal(student.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef6ff] text-[#3069a1] hover:bg-[#e0edff]" title="Show student details QR">
                            <QrCode size={16} />
                          </button>
                        )}
                        <Link href={`/admin/admission-form/${student.id}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0faf0] text-[#2d8659] hover:bg-[#dff5e5]" title="Print admission form">
                          <Printer size={16} />
                        </Link>
                        {canEditStudent && (
                        <button onClick={() => openEditForm(student)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eeefff] text-[#3033a1] hover:bg-[#e3e5ff]" title="Edit student">
                        <Edit2 size={16} />
                      </button>
                        )}
                        {canDeleteStudent && (
                        <button onClick={() => handleDelete(student)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d] hover:bg-[#ffdfe4]" title="Delete student">
                        <Trash2 size={16} />
                      </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {hasMore && (
          <div className="border-t border-[#edf0f7] p-4 text-center">
            <button type="button" onClick={() => fetchStudents({ append: true, cursor: nextCursor })} className="btn-secondary" disabled={loading || !nextCursor}>
              Load more
            </button>
          </div>
        )}
      </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Students In Section</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">
              {students.length}
              {sectionCount !== null && sectionCount > students.length ? <span className="text-base font-bold text-[#7d86a8]"> / {sectionCount}</span> : null}
            </p>
        </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Class / Section</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{classFilter}{sectionFilter}</p>
        </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Classes In Page</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{[...new Set(students.map((s) => s.class))].length}</p>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQrModal && qrCanvas[showQrModal] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowQrModal(null)}>
            <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <img src={qrCanvas[showQrModal]} alt="Student QR Code" className="mx-auto" />
              {((): Student | undefined => {
                const s = students.find((st) => st.id === showQrModal);
                return s;
              })() && (
                <div className="mt-3">
                  <p className="text-sm font-bold text-[#1f2136]">{students.find((s) => s.id === showQrModal)?.studentName}</p>
                  <p className="text-xs font-medium text-[#7d86a8]">Scan to open student details</p>
                </div>
              )}
              <button onClick={() => setShowQrModal(null)} className="btn-primary mt-4 w-full">Close</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
