"use client";

import { useState, useEffect, useRef } from "react";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";
import { Plus, X, ArrowLeft, Edit2, Search, Upload, Camera, IndianRupee, UserCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter, useParams, notFound } from "next/navigation";
import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader"; import { usePopup } from "@/components/CenterPopup";
import { PaginationControls } from "@/components/PaginationControls";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { hasPermission } from "@sri-narayana/shared";
import { uploadFile, getStudentPhotoPath, getDocumentPath } from "@/lib/uploadService";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { useClassSections } from "@/lib/useClassSections";
import { SectionManagerModal } from "./section-manager-modal";
import { StudentFormModal, CUSTOM_FEE_TYPES, type StudentFormData } from "./student-form-modal";
import { CLASS_SELECTOR_CLASSES, CLASS_LABELS, slugToClassId } from "@/lib/studentClasses";

export interface FeeStructureItem {
  id?: string;
  className: string;
  heads: { name: string; amount: number }[];
  total: number;
}

export interface Student {
  id: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  gender?: string;
  fatherName: string;
  fatherPhone?: string;
  fatherOccupation?: string;
  motherName: string;
  motherPhone?: string;
  motherOccupation?: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  villageArea?: string;
  mandal?: string;
  district?: string;
  pincode?: string;
  annualEnrollmentFee?: string;
  commitmentFee?: string;
  committedPayableFee?: string;
  totalConcessionAmount?: string;
  photoURL?: string;
  aadhaarNumber?: string;
  bloodGroup?: string;
  emisId?: string;
  nationality?: string;
  motherTongue?: string;
  category?: string;
  medium?: string;
  secondLanguage?: string;
  admissionType?: string;
  documentURLs?: { name: string; url: string }[];
  previousSchool?: { name: string; address: string; yearLeft: string; lastClass?: string; tcNo?: string } | null;
  siblingAdmissionNumbers?: string[];
  emergencyContact?: { name: string; phone: string; relation: string } | null;
  transportRouteId?: string;
  transportStopName?: string;
  transportFee?: number;
}

export interface TransportRoute {
  id: string;
  name: string;
  stops: { name: string; fee: number }[];
}

const STUDENTS_PAGE_SIZE = 25;


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

export default function StudentsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const searchParams = useSearchParams();
  const router = useRouter();
  // This page lives at /admin/students/<class-id> — the class comes from the
  // URL (case-insensitive, optional "class-" prefix) and cannot be switched
  // inside the page. Unknown slugs render the not-found page.
  const routeParams = useParams<{ classId?: string }>();
  const routeClassId = slugToClassId(routeParams?.classId ?? "");
  const canCreateStudent = Boolean(role && hasPermission(role, "students.create"));
  const canEditStudent = Boolean(role && hasPermission(role, "students.edit"));
  const canDeleteStudent = Boolean(role && hasPermission(role, "students.delete"));
  const canViewFees = Boolean(role && hasPermission(role, "fees.view"));
  // Active list vs archived list. Archived students keep all history
  // (payments, attendance, marks, links) and can be restored from their profile.
  const [statusTab, setStatusTab] = useState<"active" | "archived">("active");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState(routeClassId || "1");
  const [sectionFilter, setSectionFilter] = useState("A");
  const [sectionByClass, setSectionByClass] = useState<Record<string, string>>(() => defaultClassSections());
  const { sectionsFor, applySections } = useClassSections();
  const [showSectionManager, setShowSectionManager] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const toast = usePopup();
  const deepLinkEditRef = useRef<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);

  const academicFeeForClass = (className: string) => {
    const found = feeStructures.find((fs) => fs.className === className);
    return String(found?.total ?? FALLBACK_FEE_BY_CLASS[className] ?? 0);
  };

  const selectClassFilter = (classId: string) => {
    setClassFilter(classId);
    const sections = sectionsFor(classId);
    const remembered = sectionByClass[classId];
    setSectionFilter(remembered && sections.includes(remembered) ? remembered : sections[0] ?? "A");
  };

  // If the configured sections change (edit/merge/delete), keep the current
  // selection valid.
  useEffect(() => {
    const sections = sectionsFor(classFilter);
    if (sections.length > 0 && !sections.includes(sectionFilter)) {
      setSectionFilter(sections[0]);
      setSectionByClass((prev) => ({ ...prev, [classFilter]: sections[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsFor]);

  const selectClassSection = (classId: string, section: string) => {
    setSectionByClass((prev) => ({ ...prev, [classId]: section }));
    setClassFilter(classId);
    setSectionFilter(section);
  };

  const [formData, setFormData] = useState<StudentFormData>({
    admissionNumber: "",
    schoolId: "",
    studentName: "",
    class: "1",
    section: "A",
    gender: "",
    fatherName: "",
    fatherPhone: "",
    fatherOccupation: "",
    motherName: "",
    motherPhone: "",
    motherOccupation: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    address: "",
    villageArea: "",
    mandal: "",
    district: "",
    pincode: "",
    photoURL: "",
    aadhaarNumber: "",
    bloodGroup: "",
    emisId: "",
    nationality: "",
    motherTongue: "",
    category: "",
    medium: "",
    secondLanguage: "",
    admissionType: "",
    documentURLs: [] as { name: string; url: string }[],
    previousSchoolName: "",
    previousSchoolAddress: "",
    previousSchoolYearLeft: "",
    previousSchoolLastClass: "",
    previousSchoolTcNo: "",
    siblingAdmissionNumbers: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    transportRouteId: "",
    transportStopName: "",
    transportFee: "0",
    annualEnrollmentFee: academicFeeForClass("1"),
    commitmentFee: "0",
    feeHeads: [] as { name: string; original: number; committed: number }[]
  });
  const [newFeeType, setNewFeeType] = useState<string>("Books");
  const [newFeeAmount, setNewFeeAmount] = useState<string>("");
  const [feeFieldsDirty, setFeeFieldsDirty] = useState(false);

  // Add (or update) a per-student fee-type row in Fee Details.
  const addFeeHead = () => {
    const amount = Math.max(0, Number(newFeeAmount) || 0);
    if (!newFeeType || amount <= 0) {
      toast.error("Enter an amount above ₹0 for the fee type.");
      return;
    }
    setFormData((prev) => {
      const heads = [...prev.feeHeads];
      const idx = heads.findIndex((h) => h.name === newFeeType);
      if (idx >= 0) heads[idx] = { ...heads[idx], original: amount, committed: amount };
      else heads.push({ name: newFeeType, original: amount, committed: amount });
      const totalCommitted = heads.reduce((s, h) => s + h.committed, 0);
      return { ...prev, feeHeads: heads, commitmentFee: String(totalCommitted) };
    });
    setNewFeeAmount("");
    setFeeFieldsDirty(true);
    toast.success(`${newFeeType} fee added.`);
  };

  const removeFeeHead = (name: string) => {
    setFormData((prev) => {
      const heads = prev.feeHeads.filter((h) => h.name !== name);
      const totalCommitted = heads.reduce((s, h) => s + h.committed, 0);
      return { ...prev, feeHeads: heads, commitmentFee: String(totalCommitted) };
    });
    setFeeFieldsDirty(true);
  };

  // Keep the "Transport Fee" breakdown row in sync with the chosen bus stop.
  // Called whenever route/stop changes; replaces the old manual input.
  const syncTransportFeeRow = (routeId: string, stopName: string) => {
    const stop = transportRoutes
      .find((r) => r.id === routeId)
      ?.stops.find((s) => s.name === stopName);
    setFormData((prev) => {
      let heads = [...prev.feeHeads];
      const idx = heads.findIndex((h) => h.name === "Transport Fee");
      if (!stop) {
        if (idx >= 0) heads.splice(idx, 1);
      } else if (idx >= 0) {
        heads[idx] = { ...heads[idx], original: stop.fee, committed: stop.fee };
      } else {
        heads.push({ name: "Transport Fee", original: stop.fee, committed: stop.fee });
      }
      const totalCommitted = heads.reduce((s, h) => s + h.committed, 0);
      return { ...prev, feeHeads: heads, commitmentFee: String(totalCommitted) };
    });
    setFeeFieldsDirty(true);
  };

  // Reload whenever the class/section/year selection changes, so the
  // list always shows exactly the selected section (never a mixed list).
  useEffect(() => {
    // Client guard: no selected year -> no query (Phase 2 scoping).
    if (!selectedYear?.id) {
      setStudents([]);
      setLoading(false);
      return;
    }
    fetchStudents({ page: 0, cursor: null });
    fetchSectionCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear?.id, classFilter, sectionFilter, statusTab]);
  useEffect(() => {
    fetchTransportRoutes();
  }, []);
  useRefreshOnFocus(() => fetchStudents());

  useEffect(() => {
    if (selectedYear?.id) {
      fetchFeeStructures(selectedYear.id);
    }
  }, [selectedYear?.id]);

  // Auto-open the form when navigated via the Admission Form sub-nav link.
  useEffect(() => {
    if (searchParams.get("admission") === "1" && canCreateStudent) {
      openAddForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fee auto-fill needs every structure for the year: one bounded call
  // (pageSize=100, server caps the underlying read at 200 docs).
  const fetchFeeStructures = async (academicYearId: string) => {
    setFeeLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId, pageSize: "100" });
      const data = await adminApiRequest<{ ok?: boolean; structures?: FeeStructureItem[] }>(
        `/api/admin/fee-structures?${params}`
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

  // Students are scoped by academic year + class + section. All student docs
  // are backfilled with academicYearId, so this filter is safe.
  const buildStudentQuery = (cursor?: string | null) => {
    const params = new URLSearchParams();
    params.set("pageSize", String(STUDENTS_PAGE_SIZE));
    params.set("status", statusTab);
    if (selectedYear?.id) params.set("academicYearId", selectedYear.id);
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
      const params = new URLSearchParams({ count: "1", status: statusTab });
      if (selectedYear?.id) params.set("academicYearId", selectedYear.id);
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

  const fetchStudents = async (options: { cursor?: string | null; page?: number } = {}) => {
    const targetPage = options.page ?? currentPage;
    const targetCursor = options.cursor !== undefined ? options.cursor : pageCursors[targetPage] ?? null;
    try {
      setLoading(true);
      const data = await adminApiRequest<{ success?: boolean; data: Student[]; nextCursor?: string | null; hasMore?: boolean }>(
        `/api/admin/students?${buildStudentQuery(targetCursor)}`
      );
      setStudents(data.data ?? []);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
      setCurrentPage(targetPage);
      setPageCursors((prev) => {
        const next = targetPage === 0 ? [null] : prev.slice(0, targetPage + 1);
        if (data.nextCursor) next[targetPage + 1] = data.nextCursor;
        return next;
      });
    } catch (err) {
      console.error("Failed to fetch students:", err);
      toast.error("Failed to fetch students", err instanceof AdminApiError ? err.message : undefined);
      // On a load failure, clear the list. Otherwise the
      // previously loaded class's students stay on screen, making every class
      // you switch to look like it has the *same* students — which is exactly
      // what happens when a request fails (e.g. Firestore quota 429).
      setStudents([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextStudentPage = () => {
    if (!nextCursor) return;
    fetchStudents({ page: currentPage + 1, cursor: nextCursor });
  };

  const fetchPreviousStudentPage = () => {
    if (currentPage === 0) return;
    const previousPage = currentPage - 1;
    fetchStudents({ page: previousPage, cursor: pageCursors[previousPage] ?? null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    

    const isEditing = Boolean(editingId);
    if (isEditing ? !canEditStudent : !canCreateStudent) {
      toast.error(isEditing ? "Your role cannot edit students." : "Your role cannot add students.");
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        // admissionNumber is auto-generated server-side on create and immutable
        // on edit — never sent from the form.
        schoolId: formData.schoolId,
        studentName: formData.studentName,
        class: formData.class,
        classId: formData.class,
        section: formData.section,
        sectionId: formData.section,
        academicYearId: selectedYear?.id || "",
        gender: formData.gender,
        fatherName: formData.fatherName,
        fatherPhone: formData.fatherPhone,
        fatherOccupation: formData.fatherOccupation,
        motherName: formData.motherName,
        motherPhone: formData.motherPhone,
        motherOccupation: formData.motherOccupation,
        dateOfBirth: formData.dateOfBirth,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        villageArea: formData.villageArea,
        mandal: formData.mandal,
        district: formData.district,
        pincode: formData.pincode,
        photoURL: formData.photoURL,
        aadhaarNumber: formData.aadhaarNumber,
        bloodGroup: formData.bloodGroup,
        emisId: formData.emisId,
        nationality: formData.nationality,
        motherTongue: formData.motherTongue,
        category: formData.category,
        medium: formData.medium,
        secondLanguage: formData.secondLanguage,
        admissionType: formData.admissionType,
        documentURLs: formData.documentURLs,
        siblingAdmissionNumbers: formData.siblingAdmissionNumbers
          ? formData.siblingAdmissionNumbers.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      };

      const includeFeeFields = !isEditing || feeFieldsDirty;
      if (includeFeeFields) {
        payload.annualEnrollmentFee = Number(formData.annualEnrollmentFee || 0);
        payload.commitmentFee = Number(formData.commitmentFee || 0);
        payload.committedPayableFee = Number(formData.commitmentFee || 0);
        payload.feeHeads = formData.feeHeads.length > 0 ? formData.feeHeads : undefined;
      }

      const hasPreviousSchool = Boolean(
        formData.previousSchoolName ||
          formData.previousSchoolAddress ||
          formData.previousSchoolYearLeft ||
          formData.previousSchoolLastClass ||
          formData.previousSchoolTcNo
      );
      payload.previousSchool = hasPreviousSchool
        ? {
            name: formData.previousSchoolName,
            address: formData.previousSchoolAddress || "",
            yearLeft: formData.previousSchoolYearLeft || "",
            lastClass: formData.previousSchoolLastClass || "",
            tcNo: formData.previousSchoolTcNo || ""
          }
        : null;

      const hasEmergencyContact = Boolean(
        formData.emergencyContactName ||
          formData.emergencyContactPhone ||
          formData.emergencyContactRelation
      );
      payload.emergencyContact = hasEmergencyContact
        ? {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactPhone || "",
            relation: formData.emergencyContactRelation || ""
          }
        : null;

      // Always send transport fields so selecting "No transport" clears the
      // route/stop/fee instead of preserving the previous assignment.
      payload.transportRouteId = formData.transportRouteId;
      payload.transportStopName = formData.transportRouteId ? formData.transportStopName : "";
      if (includeFeeFields) {
        payload.transportFee = formData.transportRouteId
          ? Number(formData.feeHeads.find((h) => h.name === "Transport Fee")?.committed ?? 0)
          : 0;
      }

      await adminApiRequest(
        isEditing ? `/api/admin/students/${editingId}` : "/api/admin/students",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        }
      );

      toast.success(isEditing ? "Student updated successfully!" : "Student added successfully!");
      resetForm();
      setShowForm(false);
      fetchStudents();
    } catch (err) {
      toast.error(
        isEditing ? "Failed to update student" : "Failed to add student",
        err instanceof AdminApiError ? err.message : undefined
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updates: Partial<typeof prev> = {
        ...prev,
        [name]: value
      };
      if (name === "class") {
        const fs = feeStructures.find((s) => s.className === value);
        const totalFee = fs?.total ?? Number(FALLBACK_FEE_BY_CLASS[value] ?? 0);
        updates.annualEnrollmentFee = String(totalFee);
        // Rebuild structure rows but KEEP custom fee-type rows
        // (Books / Booklet / Other / Transport Fee).
        const customRows = prev.feeHeads.filter((h) =>
          (CUSTOM_FEE_TYPES as readonly string[]).includes(h.name)
        );
        if (fs?.heads) {
          updates.feeHeads = [
            ...fs.heads.map((h) => ({
              name: h.name,
              original: h.amount,
              committed: h.amount
            })),
            ...customRows
          ];
        } else {
          updates.feeHeads = [{ name: "Tuition Fee", original: totalFee, committed: totalFee }, ...customRows];
        }
      }
      // Changing route clears the stop (and its auto transport-fee row).
      if (name === "transportRouteId") {
        updates.transportStopName = "";
        const heads = prev.feeHeads.filter((h) => h.name !== "Transport Fee");
        updates.feeHeads = heads;
        updates.commitmentFee = String(heads.reduce((s, h) => s + h.committed, 0));
      }
      return updates as typeof prev;
    });
    if (name === "class" || name === "transportRouteId") setFeeFieldsDirty(true);
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
    } catch (err) {
      toast.error("Failed to upload photo", err instanceof Error ? err.message : undefined);
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
      // Files are stored inside the student's Firestore document (no Firebase
      // Storage on the free plan). Firestore caps a document at ~1MB, so keep
      // the combined size of all stored documents under a safe budget.
      const existingBytes = formData.documentURLs.reduce((sum, docItem) => sum + (docItem.url?.length ?? 0), 0);
      if (existingBytes + url.length > 700_000) {
        throw new Error("Document storage is full for this student (max ~700KB total). Remove an existing document or upload a smaller/compressed scan.");
      }
      setFormData((prev) => ({
        ...prev,
        documentURLs: [...prev.documentURLs, { name: file.name, url }]
      }));
    } catch (err) {
      toast.error("Failed to upload document", err instanceof Error ? err.message : undefined);
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
    setNewFeeType("Books");
    setNewFeeAmount("");
    setFormData({
      admissionNumber: "",
      schoolId: "",
      studentName: "",
      // New admissions default to the class shown in this URL.
      class: classFilter,
      section: sectionFilter,
      gender: "",
      fatherName: "",
      fatherPhone: "",
      fatherOccupation: "",
      motherName: "",
      motherPhone: "",
      motherOccupation: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      address: "",
      villageArea: "",
      mandal: "",
      district: "",
      pincode: "",
      photoURL: "",
      aadhaarNumber: "",
      bloodGroup: "",
      emisId: "",
      nationality: "",
      motherTongue: "",
      category: "",
      medium: "",
      secondLanguage: "",
      admissionType: "",
      documentURLs: [],
      previousSchoolName: "",
      previousSchoolAddress: "",
      previousSchoolYearLeft: "",
      previousSchoolLastClass: "",
      previousSchoolTcNo: "",
      siblingAdmissionNumbers: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
      transportRouteId: "",
      transportStopName: "",
      transportFee: "0",
      annualEnrollmentFee: academicFeeForClass(classFilter),
      commitmentFee: "0",
      feeHeads: []
    });
    setFeeFieldsDirty(false);
  };

  const openAddForm = () => {
    
    resetForm();
    setShowForm(true);
  };

  const openEditForm = async (row: Pick<Student, "id">) => {
    // List rows are lean (photo/documents stripped for speed) — always fetch
    // the full record so editing never saves an incomplete photo/document set.
    let student: Student;
    try {
      const res = await adminApiRequest<{ success?: boolean; data?: Student }>(
        `/api/admin/students/${row.id}`
      );
      if (!res.data) throw new Error("Student not found");
      student = { ...(row as Student), ...res.data, id: row.id };
    } catch (err) {
      toast.error(
        "Could not load student details",
        err instanceof Error ? err.message : "The student record could not be loaded. Please try again."
      );
      return false;
    }
    setEditingId(student.id);
    const rawPrevSchool = student.previousSchool as unknown;
    const prevSchool =
      typeof rawPrevSchool === "string"
        ? null
        : (rawPrevSchool as { name?: string; address?: string; yearLeft?: string; lastClass?: string; tcNo?: string } | null | undefined);
    const previousSchoolName =
      typeof rawPrevSchool === "string" ? rawPrevSchool : prevSchool?.name ?? "";
    const rawEmergency = student.emergencyContact as unknown;
    const emergContact =
      typeof rawEmergency === "string"
        ? null
        : (rawEmergency as { name?: string; phone?: string; relation?: string } | null | undefined);
    const emergencyPhone =
      typeof rawEmergency === "string" ? rawEmergency : emergContact?.phone ?? "";
    const fs = feeStructures.find((s) => s.className === student.class);
    const studentFees = student as typeof student & {
      feeHeads?: { name: string; original: number; committed: number }[];
      commitmentFee?: number;
      committedPayableFee?: number;
    };
    const existingHeads = studentFees.feeHeads;
    const committedPayable = studentFees.commitmentFee ?? studentFees.committedPayableFee ?? student.annualEnrollmentFee ?? 0;
    const feeHeads = existingHeads && existingHeads.length > 0 ? [...existingHeads] : (fs?.heads.map((h) => ({
      name: h.name,
      original: h.amount,
      committed: h.amount
    })) ?? [{ name: "Tuition Fee", original: Number(student.annualEnrollmentFee || 0), committed: Number(committedPayable) }]);
    // Backward compat: legacy records store transportFee outside feeHeads —
    // surface it as a Transport Fee row so it stays editable.
    if (!feeHeads.some((h) => h.name === "Transport Fee") && Number(student.transportFee || 0) > 0) {
      const tf = Number(student.transportFee || 0);
      feeHeads.push({ name: "Transport Fee", original: tf, committed: tf });
    }
    setFormData({
      admissionNumber: student.admissionNumber,
      schoolId: (student as { schoolId?: string }).schoolId ?? "",
      studentName: student.studentName ?? "",
      class: student.class,
      section: student.section ?? "A",
      gender: student.gender ?? "",
      fatherName: student.fatherName ?? "",
      fatherPhone: student.fatherPhone ?? "",
      fatherOccupation: student.fatherOccupation ?? "",
      motherName: student.motherName ?? "",
      motherPhone: student.motherPhone ?? "",
      motherOccupation: student.motherOccupation ?? "",
      dateOfBirth: typeof student.dateOfBirth === "string" ? student.dateOfBirth.slice(0, 10) : "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      address: student.address ?? "",
      villageArea: student.villageArea ?? "",
      mandal: student.mandal ?? "",
      district: student.district ?? "",
      pincode: student.pincode ?? "",
      photoURL: student.photoURL ?? "",
      aadhaarNumber: student.aadhaarNumber ?? "",
      bloodGroup: student.bloodGroup ?? "",
      emisId: student.emisId ?? "",
      nationality: student.nationality ?? "",
      motherTongue: student.motherTongue ?? "",
      category: student.category ?? "",
      medium: student.medium ?? "",
      secondLanguage: student.secondLanguage ?? "",
      admissionType: student.admissionType ?? "",
      documentURLs: (student.documentURLs as { name: string; url: string }[]) ?? [],
      previousSchoolName,
      previousSchoolAddress: prevSchool?.address ?? "",
      previousSchoolYearLeft: prevSchool?.yearLeft ?? "",
      previousSchoolLastClass: prevSchool?.lastClass ?? "",
      previousSchoolTcNo: prevSchool?.tcNo ?? "",
      siblingAdmissionNumbers: (student.siblingAdmissionNumbers ?? []).join(", "),
      emergencyContactName: emergContact?.name ?? "",
      emergencyContactPhone: emergencyPhone,
      emergencyContactRelation: emergContact?.relation ?? "",
      transportRouteId: student.transportRouteId ?? "",
      transportStopName: student.transportStopName ?? "",
      transportFee: String(student.transportFee ?? "0"),
      annualEnrollmentFee: String(student.annualEnrollmentFee ?? academicFeeForClass(student.class)),
      commitmentFee: String(feeHeads.reduce((s, h) => s + h.committed, 0)),
      feeHeads
    });
    setFeeFieldsDirty(false);
    setShowForm(true);
    return true;
  };

  // Deep link from the admission form: /admin/students/class-1?edit=<id>.
  // Open the edit modal once, then strip the query so closing it stays closed.
  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (!editParam || !canEditStudent) return;
    const editId = editParam === "1" ? searchParams.get("id") : editParam;
    if (!editId || deepLinkEditRef.current === editId) return;
    deepLinkEditRef.current = editId;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("id");
    const query = params.toString();
    router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, { scroll: false });

    const row = students.find((s) => s.id === editId);
    void openEditForm(row ?? { id: editId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, students, canEditStudent]);

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  if (!routeClassId) notFound();
  const classLabel = CLASS_LABELS[routeClassId] ?? routeClassId;

  return (
    <>
      <PageHeader
        title={`${classLabel} Students`}
        description={`Student records for ${classLabel} — open a student to manage fees, documents, QR, and admission forms.`}
        action={
          <>
            <Link
              href="/admin/students"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dfe3f1] bg-white px-4 text-sm font-bold text-[#303247] transition hover:bg-[#f4f5fb]"
            >
              <ArrowLeft size={16} />
              All classes
            </Link>
            {canViewFees && (
              <Link
                href={`/admin/fee-structures?className=${routeClassId}&add=1`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dfe3f1] bg-white px-4 text-sm font-bold text-[#303247] transition hover:bg-[#f4f5fb]"
              >
                <IndianRupee size={16} />
                Fee structure
              </Link>
            )}
            {canCreateStudent && (
              <button onClick={() => (showForm ? closeForm() : openAddForm())} className="btn-primary">
                <Plus size={18} />
                Add Student
              </button>
            )}
          </>
        }
      />

      <section className={`${showForm ? 'min-h-[100dvh]' : 'space-y-5'} p-4 md:p-6 lg:p-8`}>
        {showForm ? (
          <StudentFormModal
          formData={formData}
          setFormData={setFormData}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          editingId={editingId}
          closeForm={closeForm}
          routeClassId={routeClassId}
          classLabel={classLabel}
          sectionsFor={sectionsFor}
          uploading={uploading}
          handlePhotoUpload={handlePhotoUpload}
          handleDocumentUpload={handleDocumentUpload}
          removeDocument={removeDocument}
          transportRoutes={transportRoutes}
          syncTransportFeeRow={syncTransportFeeRow}
          removeFeeHead={removeFeeHead}
          addFeeHead={addFeeHead}
          markFeeFieldsDirty={() => setFeeFieldsDirty(true)}
          newFeeType={newFeeType}
          setNewFeeType={setNewFeeType}
          newFeeAmount={newFeeAmount}
          setNewFeeAmount={setNewFeeAmount}
        />
        ) : (
        <>

        {canEditStudent && (
          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setShowSectionManager(true)}>
              <Edit2 size={15} />
              Edit Sections · {CLASS_LABELS[classFilter] ?? classFilter}
            </button>
          </div>
        )}
        {/* Class comes from the URL — only the section can be switched here. */}
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-bold text-[#303247]">
            {classLabel} · Sections:
          </span>
          <div className="flex flex-wrap gap-2">
            {sectionsFor(classFilter).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => selectClassSection(classFilter, section)}
                aria-pressed={sectionFilter === section}
                className={`h-9 rounded-xl px-4 text-xs font-bold transition ${
                  sectionFilter === section
                    ? "bg-[#3033a1] text-white shadow"
                    : "border border-[#dfe3f1] bg-white text-[#303247] hover:bg-[#f4f5fb]"
                }`}
              >
                Section {section}
              </button>
            ))}
          </div>
        </div>
        {showSectionManager && (
          <SectionManagerModal
            classId={classFilter}
            classLabel={CLASS_LABELS[classFilter] ?? classFilter}
            sections={sectionsFor(classFilter)}
            onClose={() => setShowSectionManager(false)}
            onSaved={(sections) => {
              applySections(classFilter, sections);
              fetchStudents({ page: 0, cursor: null });
              fetchSectionCount();
            }}
          />
        )}

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
                if (e.key === "Enter") fetchStudents({ page: 0, cursor: null });
              }}
                className="field pl-10"
            />
          </div>
        </div>
        <span className="inline-flex h-10 items-center rounded-xl border border-[#dfe3f1] bg-[#f7f8fd] px-3 text-sm font-bold text-[#303247]">
          25 / page
        </span>
        {canDeleteStudent && (
          <div className="inline-flex h-10 items-center rounded-xl border border-[#dfe3f1] bg-[#f7f8fd] p-1 text-sm font-bold" role="tablist" aria-label="Student status">
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "active"}
              onClick={() => setStatusTab("active")}
              className={`rounded-lg px-3 py-1.5 ${statusTab === "active" ? "bg-white text-[#3033a1] shadow" : "text-[#7d86a8]"}`}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "archived"}
              onClick={() => setStatusTab("archived")}
              className={`rounded-lg px-3 py-1.5 ${statusTab === "archived" ? "bg-white text-[#3033a1] shadow" : "text-[#7d86a8]"}`}
            >
              Archived
            </button>
          </div>
        )}
        <button type="button" onClick={() => fetchStudents({ page: 0, cursor: null })} className="btn-secondary">
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
                    <button onClick={() => router.push(`/admin/student/${student.id}`)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]" aria-label="View student profile">
                      <UserCircle size={16} />
                    </button>
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
                      <button onClick={() => router.push(`/admin/student/${student.id}`)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1] hover:bg-[#e3e5ff] mx-auto" title="View student profile">
                        <UserCircle size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {(students.length > 0 || currentPage > 0 || hasMore) && (
          <PaginationControls
            page={currentPage}
            pageSize={STUDENTS_PAGE_SIZE}
            itemCount={students.length}
            totalItems={searchTerm.trim() ? null : sectionCount}
            itemLabel="students"
            hasPrevious={currentPage > 0}
            hasNext={hasMore}
            loading={loading}
            onPrevious={fetchPreviousStudentPage}
            onNext={fetchNextStudentPage}
          />
        )}
      </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Students In Section</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">
              {sectionCount ?? students.length}
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

        </>
      )}
      </section>
    </>
  );
}
