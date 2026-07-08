import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

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
    if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id, ...snapshot.data() } });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student' }, { status: 500 });
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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;
    const body = await request.json();

    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
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

    if (!studentName || !classStr || !section) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const existing = snapshot.data() ?? {};
    const originalFee = Number(body.annualEnrollmentFee ?? existing.annualEnrollmentFee ?? 0);
    const committedPayableFee = Number(body.commitmentFee ?? body.committedPayableFee ?? existing.commitmentFee ?? existing.committedPayableFee ?? 0);
    const concessionAmount = Math.max(0, originalFee - committedPayableFee);
    const totalFeeAmount = committedPayableFee;
    const totalFeesPaid = Number(existing.totalFeesPaid ?? 0);
    const totalFeesDue = Math.max(0, totalFeeAmount - totalFeesPaid);
    const feeStatus = totalFeesDue <= 0 ? 'paid' : totalFeesPaid > 0 ? 'partial' : 'pending';

    const updateData: Record<string, unknown> = {
      studentName,
      studentNameLower: normalizeText(studentName),
      class: classStr,
      classId: body.classId || classStr,
      section,
      sectionId: body.sectionId || section,
      branchId: body.branchId || existing.branchId || "default-branch",
      academicYearId: body.academicYearId ?? existing.academicYearId ?? "",
      schoolId: body.schoolId !== undefined ? String(body.schoolId).trim() : (existing.schoolId ?? ""),
      status: body.status || existing.status || "active",
      rollNo: Number(body.rollNo ?? existing.rollNo ?? String(existing.admissionNumber ?? "").replace(/\D/g, "") ?? 0),
      gender: gender ?? existing.gender ?? '',
      fatherName: fatherName || '',
      fatherPhone: body.fatherPhone ?? existing.fatherPhone ?? '',
      motherName: motherName || '',
      motherPhone: body.motherPhone ?? existing.motherPhone ?? '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      email: email || '',
      phone: phone || '',
      address: address || '',
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
      searchKeywords: searchKeywords(studentName, String(existing.admissionNumber ?? ""), phone || existing.phone || ""),
      feeLastUpdated: new Date(),
      updatedAt: new Date()
    };

    await docRef.update(updateData);

    return NextResponse.json({ success: true, data: { id, ...existing, ...updateData } });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ success: false, error: 'Failed to update student' }, { status: 500 });
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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;
    const docRef = db.collection('students').doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}
