"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { auth } from "@sri-narayana/shared/firebase/client";
import { getClassDisplayName } from "@/lib/classUtils";

interface StudentOption {
  id: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
}

export default function CreateConcessionPage() {
  const router = useRouter();
  const user = auth.currentUser;
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    studentId: "",
    concessionType: "percentage",
    concessionAmount: "",
    concessionPercent: "",
    reason: "",
    validFrom: "",
    validUpto: ""
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      // Fetch from Firestore directly or from API
      const response = await fetch("/api/admin/students");
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const student = students.find((s) => s.id === formData.studentId);
      if (!student) {
        setError("Please select a student");
        setLoading(false);
        return;
      }

      const payload = {
        ...formData,
        studentId: formData.studentId,
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        concessionAmount: formData.concessionType === "fixed" ? parseFloat(formData.concessionAmount) : 0,
        concessionPercent: formData.concessionType === "percentage" ? parseFloat(formData.concessionPercent) : 0,
        userId: user?.uid
      };

      const response = await fetch("/api/admin/concessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        router.push("/admin/fee-concessions");
      } else {
        setError(data.error || "Failed to create concession");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grant Legacy Fee Concession"
        description="Create a legacy concession request for a student"
      />
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This form supports legacy concession requests only and is retained for backward compatibility.
      </div>

      <div className="max-w-2xl rounded-lg bg-white p-6 shadow-sm border border-stone-200">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-900">
              Select Student *
            </label>
            <select
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              required
              className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choose a student...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentName} ({student.admissionNumber}) - {getClassDisplayName(student.class)}-{student.section}
                </option>
              ))}
            </select>
          </div>

          {/* Concession Type */}
          <div>
            <label className="block text-sm font-medium text-stone-900">
              Concession Type *
            </label>
            <div className="mt-2 flex gap-4">
              {["percentage", "fixed"].map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="concessionType"
                    value={type}
                    checked={formData.concessionType === type}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span className="text-sm text-stone-700">
                    {type === "percentage" ? "Percentage" : "Fixed Amount"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Concession Amount/Percent */}
          <div className="grid grid-cols-2 gap-4">
            {formData.concessionType === "percentage" ? (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-900">
                  Concession Percentage *
                </label>
                <input
                  type="number"
                  name="concessionPercent"
                  value={formData.concessionPercent}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  required
                  placeholder="0-100"
                  className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-900">
                  Concession Amount (₹) *
                </label>
                <input
                  type="number"
                  name="concessionAmount"
                  value={formData.concessionAmount}
                  onChange={handleChange}
                  min="0"
                  required
                  placeholder="Enter amount"
                  className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-stone-900">
              Reason for Concession *
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              minLength={10}
              rows={4}
              placeholder="Explain why this concession is being granted..."
              className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Validity Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-900">
                Valid From *
              </label>
              <input
                type="date"
                name="validFrom"
                value={formData.validFrom}
                onChange={handleChange}
                required
                className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-900">
                Valid Upto *
              </label>
              <input
                type="date"
                name="validUpto"
                value={formData.validUpto}
                onChange={handleChange}
                required
                className="mt-2 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {loading ? "Creating..." : "Grant Concession"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-300 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
