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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Students" description="Manage student records" />
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          <Plus size={18} />
          Add Student
        </button>
      </div>

      {/* Add Student Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Add New Student</h3>
            <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Admission Number */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Admission Number *
                </label>
                <input
                  type="text"
                  name="admissionNumber"
                  value={formData.admissionNumber}
                  onChange={handleChange}
                  required
                  placeholder="e.g., ADM001"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Student Name */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Student Name *
                </label>
                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  required
                  placeholder="Full name"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Class */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Class *
                </label>
                <select
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Section *
                </label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {SECTION_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Annual Enrollment Fee */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Annual Enrollment Fee
                </label>
                <input
                  type="number"
                  min="0"
                  name="annualEnrollmentFee"
                  value={formData.annualEnrollmentFee}
                  onChange={handleChange}
                  placeholder="₹0"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Commitment Fee */}
              <div>
                <label className="block text-sm font-medium text-stone-900">
                  Commitment Fee
                </label>
                <input
                  type="number"
                  min="0"
                  name="commitmentFee"
                  value={formData.commitmentFee}
                  onChange={handleChange}
                  placeholder="₹0"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-sm font-medium text-stone-900">Father Name</label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  placeholder="Father's name"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Mother Name */}
              <div>
                <label className="block text-sm font-medium text-stone-900">Mother Name</label>
                <input
                  type="text"
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  placeholder="Mother's name"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-stone-900">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-900">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-stone-900">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit number"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-stone-900">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address"
                rows={3}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
              >
                Add Student
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-stone-200 text-stone-900 font-semibold hover:bg-stone-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              Class {cls}
            </option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="rounded-lg border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-stone-500">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-6 text-center text-stone-500">No students found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-stone-900">Admission No.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-stone-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-stone-900">Class</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-stone-900">Father Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-stone-900">Phone</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-stone-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-stone-200 hover:bg-stone-50">
                    <td className="px-6 py-4 text-sm text-stone-900 font-medium">{student.admissionNumber}</td>
                    <td className="px-6 py-4 text-sm text-stone-900">{student.studentName}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{student.class}-{student.section}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{student.fatherName}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{student.phone}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Total Students</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{students.length}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
          <p className="text-sm text-emerald-600 font-medium">Showing</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{filteredStudents.length}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
          <p className="text-sm text-amber-600 font-medium">Classes</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{[...new Set(students.map((s) => s.class))].length}</p>
        </div>
      </div>
    </div>
  );
}
