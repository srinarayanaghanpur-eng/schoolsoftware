import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { createApprovalRequest } from "@/lib/approvalEngine";

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

    // NOTE: do not use Firestore orderBy('admissionNumber') here — it silently
    // drops any student document missing that field, which made the list show
    // fewer students than the dashboard count. Fetch all and sort in memory so
    // every student appears regardless of which fields are populated.
    const snapshot = await query.get();
    const students = snapshot.docs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));

    students.sort((a: any, b: any) =>
      String(a.admissionNumber ?? '').localeCompare(String(b.admissionNumber ?? ''), undefined, { numeric: true })
    );

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

    // Whether new admissions require admin approval. Controlled by the
    // settings/admissions doc (default true), overridable per-request.
    let requireApproval = true;
    try {
      const cfgSnap = await db.collection("settings").doc("admissions").get();
      const cfg = cfgSnap.exists ? cfgSnap.data() : undefined;
      if (cfg && typeof cfg.requireApproval === "boolean") requireApproval = cfg.requireApproval;
    } catch {
      // settings doc unavailable → keep default (require approval)
    }
    if (typeof body.requireApproval === "boolean") requireApproval = body.requireApproval;

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
      admissionStatus: requireApproval ? "pending" : "approved",
      feeLastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('students').add(studentData);

    // Raise an approval request only when approval is required.
    if (requireApproval) try {
      await createApprovalRequest({
        requestType: "admission",
        entityType: "student",
        entityId: docRef.id,
        title: `Admission: ${studentName} (${admissionNumber})`,
        description: `Class ${classStr}-${section}`,
        requestedBy: auth.uid,
        requestedByName: auth.name ?? auth.uid,
        payload: { admissionNumber, studentName, class: classStr, section }
      });
    } catch (approvalError) {
      console.error("Admission approval request failed (student still created):", approvalError);
    }

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
