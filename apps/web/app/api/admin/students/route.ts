import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

/**
 * GET /api/admin/students
 * Get all students with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "students.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
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
    const auth = await requirePermission(request, "students.create");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const body = await request.json();
    const {
      admissionNumber,
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
    const studentData: Record<string, unknown> = {
      admissionNumber,
      studentName,
      class: classStr,
      section,
      gender: gender || '',
      fatherName: fatherName || '',
      fatherPhone: body.fatherPhone || '',
      motherName: motherName || '',
      motherPhone: body.motherPhone || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      email: email || '',
      phone: phone || '',
      address: address || '',
      photoURL: photoURL || '',
      aadhaarNumber: aadhaarNumber || '',
      documentURLs: documentURLs || [],
      previousSchool: previousSchool || null,
      siblingAdmissionNumbers: siblingAdmissionNumbers || [],
      emergencyContact: emergencyContact || null,
      transportRouteId: transportRouteId || '',
      transportStopName: transportStopName || '',
      transportFee: Number(transportFee || 0),
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
