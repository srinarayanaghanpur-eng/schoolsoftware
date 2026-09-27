import { NextRequest } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, resolveRole, enforceBodyLimit, json } from "@/lib/apiUtils";
import { markSummaryDirty } from "@/lib/markSummaryDirty";
import { writeAuditLog } from "@/lib/auditLog";
import { recalculateStudentFeeSummary } from "@/lib/feeRecalculation";

const db = adminDb();

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function searchKeywords(name: string, admissionNumber: string, phone: string) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  return Array.from(new Set([admissionNumber.toLowerCase(), phone, ...words].filter(Boolean)));
}

/**
 * GET /api/admin/students/[id]
 * Fetch a single student by ID.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePermission(request, "students.view");
    if (!auth) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return json({ success: false, error: 'Student not found' }, { status: 404 });
    }
    return json({ success: true, data: { id, ...snapshot.data() } });
  } catch (error) {
    console.error('Error fetching student:', error);
    return json({ success: false, error: 'Failed to fetch student' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/students/[id]
 * Update an existing student. Fee fields are recomputed so totals stay consistent.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Use requirePermission so admins whose role lives in the users/{uid} Firestore
  // doc (not as a custom claim) are authorized consistently with GET/POST.
  const authResult = await requirePermission(request, "students.edit");
  if (!authResult) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // Photo/document data URLs land in this body — cap before parse.
  const tooBig = enforceBodyLimit(request, 10 * 1024 * 1024);
  if (tooBig) return tooBig;
  try {
    const { id } = params;
    const body = await request.json();

    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    const {
      studentName,
      class: classStr,
      section,
      gender,
      fatherName,
      motherName,
      dateOfBirth,
      email,
      phone,
      address,
      photoURL,
      aadhaarNumber,
      documentURLs,
      previousSchool,
      siblingAdmissionNumbers,
      emergencyContact,
      transportRouteId,
      transportStopName,
      transportFee
    } = body;

    const existing = snapshot.data() ?? {};

    // True partial update: only provided keys change; everything else (name,
    // class, section, phones, names) falls back to the stored doc. Required
    // values are validated against the EFFECTIVE record, not the payload.
    const effName = (studentName ?? existing.studentName ?? "") as string;
    const effClass = (classStr ?? existing.class ?? "") as string;
    const effSection = (section ?? existing.section ?? "") as string;
    if (!String(effName).trim() || !String(effClass).trim() || !String(effSection).trim()) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    const originalFee = Number(body.annualEnrollmentFee ?? existing.annualEnrollmentFee ?? 0);
    const committedPayableFee = Number(body.commitmentFee ?? body.committedPayableFee ?? existing.commitmentFee ?? existing.committedPayableFee ?? 0);
    const concessionAmount = Math.max(0, originalFee - committedPayableFee);
    const totalFeeAmount = committedPayableFee;
    const totalFeesPaid = Number(existing.totalFeesPaid ?? 0);
    const totalFeesDue = Math.max(0, totalFeeAmount - totalFeesPaid);
    const feeStatus = totalFeesDue <= 0 ? 'paid' : totalFeesPaid > 0 ? 'partial' : 'pending';

    const updateData: Record<string, unknown> = {
      studentName: effName,
      studentNameLower: normalizeText(effName),
      class: effClass,
      classId: body.classId || effClass,
      section: effSection,
      sectionId: body.sectionId || effSection,
      branchId: body.branchId || existing.branchId || "default-branch",
      academicYearId: body.academicYearId ?? existing.academicYearId ?? "",
      schoolId: body.schoolId !== undefined ? String(body.schoolId).trim() : (existing.schoolId ?? ""),
      status: body.status || existing.status || "active",
      rollNo: Number(body.rollNo ?? existing.rollNo ?? String(existing.admissionNumber ?? "").replace(/\D/g, "") ?? 0),
      gender: gender ?? existing.gender ?? '',
      fatherName: fatherName ?? existing.fatherName ?? '',
      fatherPhone: body.fatherPhone ?? existing.fatherPhone ?? '',
      motherName: motherName ?? existing.motherName ?? '',
      motherPhone: body.motherPhone ?? existing.motherPhone ?? '',
      dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : (existing.dateOfBirth ?? null),
      email: email ?? existing.email ?? '',
      phone: phone ?? existing.phone ?? '',
      address: address ?? existing.address ?? '',
      photoURL: photoURL ?? existing.photoURL ?? '',
      aadhaarNumber: aadhaarNumber ?? existing.aadhaarNumber ?? '',
      documentURLs: documentURLs ?? existing.documentURLs ?? [],
      previousSchool: previousSchool !== undefined ? previousSchool : (existing.previousSchool ?? null),
      siblingAdmissionNumbers: siblingAdmissionNumbers ?? existing.siblingAdmissionNumbers ?? [],
      emergencyContact: emergencyContact !== undefined ? emergencyContact : (existing.emergencyContact ?? null),
      transportRouteId: transportRouteId ?? existing.transportRouteId ?? '',
      transportStopName: transportStopName ?? existing.transportStopName ?? '',
      transportFee: Number(transportFee ?? existing.transportFee ?? 0),
      annualEnrollmentFee: originalFee,
      commitmentFee: committedPayableFee,
      committedPayableFee,
      originalFeeAmount: originalFee,
      totalConcessionAmount: concessionAmount,
      feeHeads: body.feeHeads !== undefined ? body.feeHeads : existing.feeHeads || null,
      totalFeeAmount,
      totalFeesDue,
      feeStatus,
      searchKeywords: searchKeywords(effName, String(existing.admissionNumber ?? ""), (phone ?? existing.phone ?? "") as string),
      feeLastUpdated: new Date(),
      updatedAt: new Date()
    };

    await docRef.update(updateData);

    await markSummaryDirty("student:update");
    // Archive/restore changes list membership + counts — dirty the dashboard
    // cache alongside the fee-summary rebuild.
    if (body.status !== undefined && body.status !== existing.status) {
      await markSummaryDirty("student:status");
    }
    // Fee fields changed — rebuild the canonical summary so dues pages reflect
    // the edit immediately instead of waiting for the next payment.
    try {
      await recalculateStudentFeeSummary(id, String(updateData.academicYearId || ""));
    } catch (summaryError) {
      console.error("Student summary recalc failed after update:", summaryError);
    }

    return json({ success: true, data: { id, ...existing, ...updateData } });
  } catch (error) {
    console.error('Error updating student:', error);
    return json({ success: false, error: 'Failed to update student' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/students/[id]
 * Remove a student record.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // Consistent auth with GET/POST: resolves role from custom claim OR users/{uid} doc.
  const authResult = await requirePermission(request, "students.delete");
  if (!authResult) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;
    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return json({ success: false, error: 'Student not found' }, { status: 404 });
    }
    const existing = (snapshot.data() ?? {}) as Record<string, unknown>;

    await docRef.delete();
    // Cascade: remove derived fee-summary read-models so reports stop counting
    // a deleted student. Payments/receipts are financial audit trail and stay.
    try {
      const sums = await db.collection("studentFeeSummaries").where("studentId", "==", id).get();
      const batch = db.batch();
      sums.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (cascadeError) {
      console.error("Student delete: fee-summary cascade failed for", id, cascadeError);
    }
    await markSummaryDirty("student:delete");

    // Destructive op — record who deleted which student. Audit failure must
    // not fail the (already completed) deletion.
    try {
      await writeAuditLog({
        action: "student.deleted",
        entityType: "student",
        entityId: id,
        actorId: authResult.uid,
        actorRole: (await resolveRole(authResult)) ?? "unknown",
        oldValues: {
          studentName: existing.studentName ?? "",
          admissionNumber: existing.admissionNumber ?? "",
          class: existing.class ?? ""
        }
      });
    } catch (auditError) {
      console.error("Student delete: audit log write failed for", id, auditError);
    }
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}

