"use client";

import { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";

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
}

const CLASS_OPTIONS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];

// Official annual school fee per class — Fee Structure AY 2026-27 (Sri Narayana High School).
const FEE_BY_CLASS: Record<string, number> = {
  Nur: 17000,
  LKG: 18000,
  UKG: 19000,
  "1": 20000,
  "2": 21000,
  "3": 22000,
  "4": 23000,
  "5": 24000,
  "6": 27000,
  "7": 28000,
  "8": 29000,
  "9": 30000,
  "10": 33000
};

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

const academicFeeForClass = (className: string) => String(FEE_BY_CLASS[className] ?? 0);

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

export default function StudentsPage() {
  const { role } = useAdminSession();
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

  const [formData, setFormData] = useState({
    admissionNumber: "",
    studentName: "",
    class: "1",
    section: "A",
    fatherName: "",
    motherName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    address: "",
    annualEnrollmentFee: academicFeeForClass("1"),
    commitmentFee: "0"
  });

  useEffect(() => {
    fetchStudents();
  }, []);

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
      const payload = {
        ...formData,
        annualEnrollmentFee: Number(formData.annualEnrollmentFee || 0),
        commitmentFee: Number(formData.commitmentFee || 0)
      };

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

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      admissionNumber: "",
      studentName: "",
      class: "1",
      section: "A",
      fatherName: "",
      motherName: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      address: "",
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
    setFormData({
      admissionNumber: student.admissionNumber,
      studentName: student.studentName ?? "",
      class: student.class,
      section: student.section ?? "A",
      fatherName: student.fatherName ?? "",
      motherName: student.motherName ?? "",
      dateOfBirth: typeof student.dateOfBirth === "string" ? student.dateOfBirth.slice(0, 10) : "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      address: student.address ?? "",
      // Keep the academic fee locked to the official class fee.
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
                  <label className="block text-sm font-semibold text-[#303247]">Academic Fee (Annual)</label>
                  <input
                    type="text"
                    name="annualEnrollmentFee"
                    value={`₹${Number(formData.annualEnrollmentFee || 0).toLocaleString("en-IN")}`}
                    readOnly
                    className="field mt-1 cursor-not-allowed bg-[#f4f5fb] font-semibold text-[#5a6488]"
                  />
                  <p className="mt-1 text-xs font-medium text-[#7d86a8]">Auto-set from the {CLASS_LABELS[formData.class] ?? formData.class} fee — AY 2026-27 structure.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Commitment Fee</label>
                  <input type="number" min="0" name="commitmentFee" value={formData.commitmentFee} onChange={handleChange} placeholder="₹0" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Father Name</label>
                  <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} placeholder="Father's name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Mother Name</label>
                  <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} placeholder="Mother's name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Date of Birth</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#303247]">Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Street address" rows={3} className="field mt-1" />
              </div>

              <div className="flex flex-wrap gap-3">
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
                  {(canEditStudent || canDeleteStudent) && (
                    <div className="flex shrink-0 items-center gap-2">
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
                  )}
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
                      {canEditStudent || canDeleteStudent ? (
                        <div className="flex items-center justify-center gap-2">
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
                      ) : (
                        <span className="text-sm font-medium text-[#9aa4c4]">View only</span>
                      )}
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
      </section>
    </>
  );
}
