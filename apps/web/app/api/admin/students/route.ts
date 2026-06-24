import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";

const db = adminDb();

/**
 * GET /api/admin/students
 * Get all students with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const classStr = searchParams.get('class');
    const section = searchParams.get('section');

    let query: any = db.collection('students');

    if (classStr) {
      query = query.where('class', '==', classStr);
    }
    if (section) {
      query = query.where('section', '==', section);
    }

    query = query.orderBy('admissionNumber', 'asc');

    const snapshot = await query.get();
    const students = snapshot.docs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, data: students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      admissionNumber,
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

    // Validation
    if (!admissionNumber || !studentName || !classStr || !section) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if admission number already exists
    const existingSnapshot = await db
      .collection('students')
      .where('admissionNumber', '==', admissionNumber)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Admission number already exists' },
        { status: 400 }
      );
    }

    const annualEnrollmentFee = Number(body.annualEnrollmentFee || 0);
    const commitmentFee = Number(body.commitmentFee || 0);
    const totalFeeAmount = annualEnrollmentFee + commitmentFee;
    const totalFeesPaid = 0;
    const totalFeesDue = totalFeeAmount;
    const feeStatus = totalFeeAmount > 0 ? 'pending' : 'paid';

    // Create student document
    const studentData = {
      admissionNumber,
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
      totalFeesPaid,
      feeStatus,
      attendancePercentage: 0,
      feeLastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('students').add(studentData);

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, ...studentData }
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create student' },
      { status: 500 }
    );
  }
}
