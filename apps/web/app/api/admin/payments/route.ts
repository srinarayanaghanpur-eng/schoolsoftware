import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

/**
 * GET /api/admin/payments
 * Get all payments
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "fees.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');

    let query: any = db.collection('payments');

    if (studentId) {
      query = query.where('studentId', '==', studentId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    const payments = snapshot.docs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/payments
 * Record a new payment
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "fees.create");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const body = await request.json();
    const {
      studentId,
      amountPaid,
      paymentType,
      paymentMethod,
      concessionId,
      transactionId,
      remarks,
      userId
    } = body;

    // Validation
    if (!studentId || !amountPaid || !paymentType || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get student data
    const studentSnap = await db.collection('students').doc(studentId).get();
    if (!studentSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentSnap.data();
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student data unavailable' },
        { status: 500 }
      );
    }

    // Generate receipt number
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 0);

    const countSnapshot = await db
      .collection('payments')
      .where('createdAt', '>=', monthStart)
      .where('createdAt', '<=', monthEnd)
      .get();

    const count = String(countSnapshot.size + 1).padStart(4, '0');
    const receiptNumber = `RCP-${year}-${month}-${count}`;

    // Calculate remaining amount
    const amountDue = student.totalFeesDue || 0;
    const remainingAmount = Math.max(0, amountDue - amountPaid);

    // Create payment record
    const feeStatus = remainingAmount === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

    const paymentData = {
      studentId,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      amountDue,
      amountPaid,
      remainingAmount,
      paymentType,
      concessionApplied: !!concessionId,
      concessionId: concessionId || null,
      paymentDate: new Date(),
      paymentMethod,
      transactionId: transactionId || null,
      receiptNumber,
      remarks: remarks || null,
      recordedBy: userId,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const paymentRef = await db.collection('payments').add(paymentData);

    // Update student fee status
    await db.collection('students').doc(studentId).update({
      totalFeesPaid: (student.totalFeesPaid || 0) + amountPaid,
      totalFeesDue: remainingAmount,
      feeStatus,
      lastPaymentDate: new Date(),
      feeLastUpdated: new Date()
    });

    // Create receipt
    const receiptData = {
      receiptNumber,
      paymentId: paymentRef.id,
      studentId,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      class: student.class,
      section: student.section,
      amountPaid,
      paymentDate: new Date(),
      receiptDate: new Date(),
      issuedBy: userId,
      status: 'issued',
      createdAt: new Date()
    };

    await db.collection('receipts').add(receiptData);

    // Log audit
    await db.collection('feeAuditLogs').add({
      action: 'payment_recorded',
      entityType: 'payment',
      entityId: paymentRef.id,
      studentId,
      changes: {
        oldData: {},
        newData: paymentData
      },
      userId,
      timestamp: new Date()
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: paymentRef.id,
          ...paymentData,
          receipt: { ...receiptData }
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}
