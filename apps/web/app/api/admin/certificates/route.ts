import { FieldValue } from "firebase-admin/firestore";
import { certificateCreateSchema, type CertificateType } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { writeAuditLog } from "@/lib/auditLog";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  transfer: "Transfer Certificate",
  character: "Character Certificate",
  bonafide: "Bonafide Certificate",
  conduct: "Conduct Certificate",
  general: "General Certificate",
  studyConductDob: "Study, Conduct & DOB Certificate",
};

const COLLECTION = "certificates";

const CERT_PREFIX: Record<CertificateType, string> = {
  transfer: "TC",
  character: "CH",
  bonafide: "BC",
  conduct: "CO",
  general: "GN",
  studyConductDob: "SCD",
};

export async function GET(req: Request) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || "";
  const certificateType = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const academicYearId = searchParams.get("academicYearId") || "";

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (studentId) query = query.where("studentId", "==", studentId);
  if (certificateType) query = query.where("certificateType", "==", certificateType);
  if (status) query = query.where("status", "==", status);

  query = query.orderBy("issueDate", "desc").limit(500);

  const snap = await query.get();
  const certificates = snap.docs.map((d) => serializeDoc(d));
  return json({ ok: true, certificates });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
}

function firstOf(student: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = str(student[key]);
    if (value) return value;
  }
  return "";
}

async function resolveAcademicYearLabel(academicYearId: string, student: Record<string, unknown>): Promise<string> {
  const direct = academicYearId.match(/20\d{2}/)?.[0];
  if (direct) return direct;

  const fromStudent = firstOf(student, ["academicYear", "academicYearName"]).match(/20\d{2}/)?.[0];
  if (fromStudent) return fromStudent;

  if (academicYearId) {
    try {
      const yearSnap = await adminDb().collection("academic_years").doc(academicYearId).get();
      const label = str(yearSnap.data()?.name).match(/20\d{2}/)?.[0];
      if (label) return label;
    } catch {
      // fall through to current year
    }
  }
  return String(new Date().getFullYear());
}

function buildSnapshot(student: Record<string, unknown>, academicYear: string): Record<string, string> {
  return {
    studentName: firstOf(student, ["studentName", "name"]),
    admissionNumber: firstOf(student, ["admissionNumber", "admissionNo"]),
    rollNo: firstOf(student, ["rollNumber", "rollNo", "roll"]),
    className: firstOf(student, ["class", "className"]),
    section: firstOf(student, ["section"]),
    dateOfBirth: firstOf(student, ["dateOfBirth", "dob"]),
    gender: firstOf(student, ["gender"]),
    fatherName: firstOf(student, ["fatherName"]),
    motherName: firstOf(student, ["motherName"]),
    address: firstOf(student, ["address"]),
    phone: firstOf(student, ["phone", "fatherPhone"]),
    admissionDate: firstOf(student, ["admissionDate"]),
    previousSchoolLastClass: firstOf(student, ["previousSchoolLastClass"]),
    conduct: "Good",
    academicYear,
  };
}

async function generateCertificateNumber(params: {
  certificateType: CertificateType;
  admissionNumber: string;
  studentId: string;
  academicYear: string;
}): Promise<string> {
  const prefix = CERT_PREFIX[params.certificateType] ?? "CERT";
  const admission = (params.admissionNumber || params.studentId).replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  const base = `SNHS/${prefix}/${params.academicYear}/${admission || "0000"}`;
  const db = adminDb();

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const existing = await db.collection(COLLECTION).where("certificateNumber", "==", candidate).limit(1).get();
    if (existing.empty) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "certificates.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = certificateCreateSchema.parse(await req.json());
    const db = adminDb();

    let studentSnap = await db.collection("students").doc(parsed.studentId).get();
    let resolvedStudentId = parsed.studentId;

    // The admin form accepts the admission number in the "Student ID" field.
    if (!studentSnap.exists && parsed.studentId) {
      const byAdmission = await db.collection("students").where("admissionNumber", "==", parsed.studentId).limit(1).get();
      if (!byAdmission.empty) {
        studentSnap = byAdmission.docs[0];
        resolvedStudentId = byAdmission.docs[0].id;
      }
    }

    const student = studentSnap.exists ? (studentSnap.data() as Record<string, unknown>) : {};
    const academicYear = await resolveAcademicYearLabel(parsed.academicYearId, student);
    const admissionNumber = firstOf(student, ["admissionNumber", "admissionNo"]);

    const certificateNumber =
      parsed.certificateNumber?.trim() ||
      (await generateCertificateNumber({
        certificateType: parsed.certificateType,
        admissionNumber,
        studentId: resolvedStudentId,
        academicYear,
      }));

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      ...parsed,
      studentId: resolvedStudentId,
      certificateNumber,
      data: { ...buildSnapshot(student, academicYear), ...(parsed.data ?? {}) },
      issuedBy: token.uid,
      createdAt: now,
      updatedAt: now,
    });

    if (studentSnap.exists) {
      const typeLabel = CERTIFICATE_LABELS[parsed.certificateType] ?? "Certificate";
      try {
        await writeAuditLog({
          action: "certificate.issued",
          entityType: "student",
          entityId: resolvedStudentId,
          actorId: token.uid,
          actorRole: String((token as { role?: string }).role || "admin"),
          newValues: {
            certificateId: ref.id,
            certificateNumber,
            certificateType: parsed.certificateType,
          },
          reason: `Issued ${typeLabel} (${certificateNumber})`,
          academicYearId: parsed.academicYearId,
        });
      } catch (auditError) {
        console.error("[certificates] audit log failed:", auditError);
      }
    }

    return json({ ok: true, id: ref.id, certificateNumber });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
