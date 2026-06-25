"use client";

import { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

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

const CLASS_OPTIONS = ["Nur", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    annualEnrollmentFee: "0",
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

    try {
      const payload = {
        ...formData,
        annualEnrollmentFee: Number(formData.annualEnrollmentFee || 0),
        commitmentFee: Number(formData.commitmentFee || 0)
      };

      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Student added successfully!");
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
          annualEnrollmentFee: "",
          commitmentFee: ""
        });
        setShowForm(false);
        fetchStudents();
      } else {
        setError(data.error || "Failed to add student");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <PageHeader
        title="Students"
        description="Manage student records, fee commitments, and class sections."
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={18} />
            Add Student
          </button>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {showForm && (
          <div className="card p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#1f2136]">Add New Student</h3>
              <button onClick={() => setShowForm(false)} className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]">
                <X size={20} />
              </button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] p-4 text-sm font-semibold text-[#c83f4d]">{error}</div>}
            {success && <div className="mb-4 rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] p-4 text-sm font-semibold text-[#0f8d52]">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Admission Number *</label>
                  <input type="text" name="admissionNumber" value={formData.admissionNumber} onChange={handleChange} required placeholder="e.g., ADM001" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Student Name *</label>
                  <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required placeholder="Full name" className="field mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Class *</label>
                  <select name="class" value={formData.class} onChange={handleChange} required className="field mt-1">
                    {CLASS_OPTIONS.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Section *</label>
                  <select name="section" value={formData.section} onChange={handleChange} required className="field mt-1">
                    {SECTION_OPTIONS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#303247]">Annual Enrollment Fee</label>
                  <input type="number" min="0" name="annualEnrollmentFee" value={formData.annualEnrollmentFee} onChange={handleChange} placeholder="₹0" className="field mt-1" />
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
                <button type="submit" className="btn-primary">Add Student</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
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
              Class {cls}
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
          <div className="overflow-x-auto">
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
                      <div className="flex items-center justify-center gap-2">
                          <button className="grid h-9 w-9 place-items-center rounded-xl bg-[#eeefff] text-[#3033a1] hover:bg-[#e3e5ff]" title="Edit student">
                          <Edit2 size={16} />
                        </button>
                          <button className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d] hover:bg-[#ffdfe4]" title="Delete student">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
