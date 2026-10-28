import { notFound } from "next/navigation";
import Link from "next/link";
import { getStudentProfile } from "@/app/admin/student/[studentId]/page.server";

export default async function StudentProfilePage({
  params,
  searchParams
}: {
  params: { studentId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const studentId = params.studentId;
  const initialTab = (typeof searchParams.tab === "string" ? searchParams.tab : "overview") as string;

  let data: any = null;
  let error: string | null = null;
  let stack: string | null = null;

  try {
    data = await getStudentProfile(studentId);
    if (!data?.student) {
      error = "Student not found.";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load student profile.";
    stack = err instanceof Error ? err.stack : undefined;
  }

  if (error) {
    return (
      <div className="p-4 md:p-7">
        <h1 className="text-2xl font-extrabold text-[#1f2136]">Student Profile - Error</h1>
        <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">
          <p className="font-bold">{error}</p>
          {stack && (
            <pre className="mt-2 text-xs text-[#7d86a8] overflow-auto max-h-64">{stack}</pre>
          )}
        </div>
        <Link href="/admin/students" className="btn-secondary mt-4">
          Back to Students
        </Link>
      </div>
    );
  }

  if (!data || !data.student) {
    return notFound();
  }

  const student = data.student;
  const admissionNumber = String(student.admissionNumber || student.admissionNo || "");
  const studentName = String(student.studentName || "");
  const className = String(student.class || "");
  const section = String(student.section || "");

  return (
    <div className="p-4 md:p-7 space-y-5">
      <h1 className="text-2xl font-extrabold text-[#1f2136]">Student Profile</h1>
      <p className="text-sm font-medium text-[#7d86a8]">{studentName} · Admission No. {admissionNumber} · Class {className}-{section}</p>
      <Link href="/admin/students" className="btn-secondary">Back to Students</Link>
      <div className="card p-4">
        <p>Student ID: {studentId}</p>
        <p>Student Name: {studentName}</p>
        <p>Class: {className}-{section}</p>
        <p>Payments: {data.payments?.length || 0}</p>
        <p>Receipts: {data.receipts?.length || 0}</p>
        <p>Certificates: {data.certificates?.length || 0}</p>
        <p>Audit Logs: {data.auditLogs?.length || 0}</p>
        <p>Exam Marks: {data.examMarks?.length || 0}</p>
      </div>
    </div>
  );
}
