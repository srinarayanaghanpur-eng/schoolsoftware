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
    <>
      <PageHeader
        title="Grant Legacy Fee Concession"
        description="Create a legacy concession request for a student."
      />
      <section className="space-y-5 p-4 md:p-7">
        <div className="rounded-2xl border border-[#ffe1ab] bg-[#fff8ea] p-4 text-sm font-semibold text-[#9f7116]">
          This form supports legacy concession requests only and is retained for backward compatibility.
        </div>

        <div className="card max-w-2xl p-5 md:p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] p-4 text-sm font-semibold text-[#c83f4d]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#303247]">
                Select Student *
              </label>
              <select
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                required
                className="field mt-2"
              >
                <option value="">Choose a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.studentName} ({student.admissionNumber}) - {getClassDisplayName(student.class)}-{student.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#303247]">
                Concession Type *
              </label>
              <div className="mt-2 flex flex-wrap gap-3">
                {["percentage", "fixed"].map((type) => (
                  <label key={type} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe3f1] bg-[#f8f9ff] px-3 py-2 text-sm font-semibold text-[#303247]">
                    <input
                      type="radio"
                      name="concessionType"
                      value={type}
                      checked={formData.concessionType === type}
                      onChange={handleChange}
                      className="h-4 w-4 accent-[#3033a1]"
                    />
                    {type === "percentage" ? "Percentage" : "Fixed Amount"}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {formData.concessionType === "percentage" ? (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">
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
                    className="field mt-2"
                  />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#303247]">
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
                    className="field mt-2"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#303247]">
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
                className="field mt-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-[#303247]">
                  Valid From *
                </label>
                <input
                  type="date"
                  name="validFrom"
                  value={formData.validFrom}
                  onChange={handleChange}
                  required
                  className="field mt-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#303247]">
                  Valid Upto *
                </label>
                <input
                  type="date"
                  name="validUpto"
                  value={formData.validUpto}
                  onChange={handleChange}
                  required
                  className="field mt-2"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? "Creating..." : "Grant Concession"}
              </button>
              <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
