"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface StudentData {
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
  photoURL?: string;
  aadhaarNumber?: string;
  previousSchool?: { name: string; address: string; yearLeft: string } | null;
  emergencyContact?: { name: string; phone: string; relation: string } | null;
  transportRouteId?: string;
  transportStopName?: string;
  annualEnrollmentFee?: number;
  commitmentFee?: number;
  totalFeeAmount?: number;
  createdAt?: string;
}

export default function AdmissionFormPage() {
  const params = useParams();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await fetch(`/api/admin/students/${params.id}`);
        const data = await res.json();
        if (data.success) setStudent(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [params.id]);

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

  const formatDate = (d: string | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-[#f4f5fb] print:bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-3 shadow-sm print:hidden">
        <Link href="/admin/students" className="flex items-center gap-2 text-sm font-semibold text-[#3033a1] hover:underline">
          <ArrowLeft size={16} /> Back to Students
        </Link>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={16} /> Print
        </button>
      </div>

      {/* Admission Form */}
      <div className="mx-auto max-w-3xl p-6 print:p-0">
        <div className="rounded-2xl bg-white p-8 shadow-sm print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b-2 border-[#3033a1] pb-4 mb-6 text-center">
            <h1 className="text-xl font-extrabold text-[#1b1d32] uppercase tracking-wide">Sri Narayana High School</h1>
            <p className="text-sm font-medium text-[#7d86a8]">Admission Form</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {/* Photo */}
            {student.photoURL && (
              <div className="col-span-full flex justify-center mb-2">
                <img src={student.photoURL} alt="Student" className="h-24 w-24 rounded-full border-2 border-[#edf0f7] object-cover" />
              </div>
            )}

            {/* Row: Admission Number & Name */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Admission Number</span>
              <p className="mt-0.5 font-bold text-[#1b1d32]">{student.admissionNumber}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Student Name</span>
              <p className="mt-0.5 font-bold text-[#1b1d32]">{student.studentName}</p>
            </div>

            {/* Row: Class & Section */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Class</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.class} - {student.section}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Date of Birth</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{formatDate(student.dateOfBirth)}</p>
            </div>

            {/* Parent Details */}
            <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Parent / Guardian</h3>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Father Name</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.fatherName || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Mother Name</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.motherName || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Phone</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.phone || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Email</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.email || "—"}</p>
            </div>
            <div className="col-span-full">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Address</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.address || "—"}</p>
            </div>

            {/* Emergency Contact */}
            {student.emergencyContact && (
              <>
                <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Emergency Contact</h3>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Name</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.emergencyContact.name}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Phone</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.emergencyContact.phone}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Relation</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.emergencyContact.relation}</p>
                </div>
              </>
            )}

            {/* Previous School */}
            {student.previousSchool && (
              <>
                <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Previous School</h3>
                </div>
                <div className="col-span-full">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">School Name</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.previousSchool.name}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Year Left</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.previousSchool.yearLeft || "—"}</p>
                </div>
              </>
            )}

            {/* Fee Details */}
            <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Fee Details</h3>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Annual Fee</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">₹{Number(student.annualEnrollmentFee || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Commitment Fee</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">₹{Number(student.commitmentFee || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Total Fee</span>
              <p className="mt-0.5 font-bold text-[#1b1d32]">₹{Number(student.totalFeeAmount || 0).toLocaleString("en-IN")}</p>
            </div>

            {/* Transport */}
            {student.transportStopName && (
              <>
                <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Transport</h3>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Stop</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.transportStopName}</p>
                </div>
              </>
            )}

            {/* Aadhaar */}
            {student.aadhaarNumber && (
              <>
                <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#3033a1] mb-2">Documents</h3>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Aadhaar Number</span>
                  <p className="mt-0.5 font-semibold text-[#1b1d32]">{student.aadhaarNumber}</p>
                </div>
              </>
            )}

            {/* Admission Date */}
            <div className="col-span-full mt-2 border-t border-[#edf0f7] pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9aa4c4]">Admission Date</span>
              <p className="mt-0.5 font-semibold text-[#1b1d32]">{formatDate(student.createdAt)}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 border-t border-[#edf0f7] pt-4 flex justify-between text-xs font-medium text-[#9aa4c4]">
            <span>Sri Narayana High School</span>
            <span>Admission Form — Generated on {new Date().toLocaleDateString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
