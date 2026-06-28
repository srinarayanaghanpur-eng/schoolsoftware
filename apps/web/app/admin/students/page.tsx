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

const CLASS_OPTIONS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

// Human-friendly labels for the class dropdown.
const CLASS_LABELS: Record<string, string> = {
  Nur: "Nursery",
  LKG: "L.K.G",
  UKG: "U.K.G",
  "1": "I Class",
  "2": "II Class",
  "3": "III Class",
  "4": "IV Class",
  "5": "V Class",
  "6": "VI Class",
  "7": "VII Class",
  "8": "VIII Class",
  "9": "IX Class",
  "10": "X Class"
};

// Fallback fees used when no fee structure exists in DB for a class
const FALLBACK_FEE_BY_CLASS: Record<string, number> = {
  Nur: 17000, LKG: 18000, UKG: 19000,
  "1": 20000, "2": 21000, "3": 22000,
  "4": 23000, "5": 24000, "6": 27000,
  "7": 28000, "8": 29000, "9": 30000, "10": 33000
};

// Next sequential admission number — highest existing numeric value + 1,
// starting from 1 when there are no students yet.
function nextAdmissionNumber(students: Student[]) {
  let max = 0;
  for (const student of students) {
    const value = parseInt(String(student.admissionNumber).replace(/\D/g, ""), 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return String(max + 1);
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-full border-t border-[#edf0f7] pt-4 pb-2">
      <h4 className="text-sm font-bold uppercase tracking-wide text-[#3033a1]">{label}</h4>
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
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("");
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

  useEffect(() => {
    fetchStudents();
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
      const res = await fetch(`/api/admin/fee-structures?academicYearId=${academicYearId}`);
      const data = await res.json();
      if (data.ok) setFeeStructures(data.structures);
    } catch { /* silently ignore */ }
    finally { setFeeLoading(false); }
  };

  const fetchTransportRoutes = async () => {
    try {
      const res = await fetch("/api/admin/transport/routes");
      const data = await res.json();
      if (data.success) setTransportRoutes(data.data);
    } catch { /* silently ignore */ }
  };

  useEffect(() => {
    let filtered = students;

    if (classFilter) {
      filtered = filtered.filter((s) => s.class === classFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((s) =>
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.admissionNumber.includes(searchTerm)
      );
    }

    setFilteredStudents(filtered);
  }, [students, classFilter, searchTerm]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/students");
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setError("Failed to fetch students");
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
        section: formData.section,
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

      const response = await fetch(
        isEditing ? `/api/admin/students/${editingId}` : "/api/admin/students",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(isEditing ? "Student updated successfully!" : "Student added successfully!");
        resetForm();
        setShowForm(false);
        fetchStudents();
      } else {
        setError(data.error || (isEditing ? "Failed to update student" : "Failed to add student"));
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
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
    setFormData((prev) => ({ ...prev, admissionNumber: nextAdmissionNumber(students) }));
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
      const response = await fetch(`/api/admin/students/${student.id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setSuccess("Student deleted.");
        fetchStudents();
      } else {
        setError(data.error || "Failed to delete student");
      }
    } catch {
      setError("An error occurred while deleting.");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const qrContent = (student: Student) =>
    JSON.stringify({
      sn: student.admissionNumber,
      n: student.studentName,
      c: student.class,
      s: student.section
    });

  const [qrCanvas, setQrCanvas] = useState<Record<string, string>>({});

  useEffect(() => {
    const generateQrs = async () => {
      const QRCode = (await import("qrcode")).default;
      const results: Record<string, string> = {};
      for (const student of filteredStudents.slice(0, 50)) {
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
  }, [filteredStudents]);

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
                    readOnly
                    required
                    className="field mt-1 cursor-not-allowed bg-[#f4f5fb] text-[#5a6488]"
                  />
                  <p className="mt-1 text-xs font-medium text-[#7d86a8]">{editingId ? "Admission number cannot be changed." : "Auto-generated sequentially."}</p>
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

        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
          <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8490b9]" />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                className="field pl-10"
            />
          </div>
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
            className="field md:max-w-[190px]"
        >
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              {CLASS_LABELS[cls] ?? `Class ${cls}`}
            </option>
          ))}
        </select>
        </div>

        <div className="card overflow-hidden">
        {loading ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-[#7d86a8]">No students found</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="divide-y divide-[#edf0f7] md:hidden">
              {filteredStudents.map((student) => (
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
                      <button onClick={() => setShowQrModal(student.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef6ff] text-[#3069a1]" aria-label="Show QR code">
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
                {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                      <td className="px-6 py-4 text-sm font-bold text-[#303247]">{student.admissionNumber}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#303247]">{student.studentName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.class}-{student.section}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.fatherName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#7d86a8]">{student.phone}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {qrCanvas[student.id] && (
                          <button onClick={() => setShowQrModal(student.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef6ff] text-[#3069a1] hover:bg-[#e0edff]" title="Show QR code">
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
      </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Total Students</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{students.length}</p>
        </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Showing</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{filteredStudents.length}</p>
        </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Classes</p>
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
                  <p className="text-xs font-medium text-[#7d86a8]">Adm# {students.find((s) => s.id === showQrModal)?.admissionNumber} · {students.find((s) => s.id === showQrModal)?.class}-{students.find((s) => s.id === showQrModal)?.section}</p>
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
