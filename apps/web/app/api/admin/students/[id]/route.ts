import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";

const db = adminDb();

/**
 * PATCH /api/admin/students/[id]
 * Update an existing student. Fee fields are recomputed so totals stay consistent.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
      fatherName,
      motherName,
      dateOfBirth,
      email,
      phone,
      address
    } = body;

    if (!studentName || !classStr || !section) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const existing = snapshot.data() ?? {};
    const annualEnrollmentFee = Number(body.annualEnrollmentFee ?? existing.annualEnrollmentFee ?? 0);
    const commitmentFee = Number(body.commitmentFee ?? existing.commitmentFee ?? 0);
    const totalFeeAmount = annualEnrollmentFee + commitmentFee;
    const totalFeesPaid = Number(existing.totalFeesPaid ?? 0);
    const totalFeesDue = Math.max(0, totalFeeAmount - totalFeesPaid);
    const feeStatus = totalFeesDue <= 0 ? 'paid' : totalFeesPaid > 0 ? 'partial' : 'pending';

    const updateData = {
      studentName,
      class: classStr,
      section,
      fatherName: fatherName || '',
      motherName: motherName || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      email: email || '',
      phone: phone || '',
      address: address || '',
      annualEnrollmentFee,
      commitmentFee,
      totalFeeAmount,
      totalFeesDue,
      feeStatus,
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
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
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
