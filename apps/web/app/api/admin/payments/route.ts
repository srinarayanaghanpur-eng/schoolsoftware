import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

/**
 * GET /api/admin/payments
 * Get payments/receipts with Firestore filters and cursor pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "fees.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const branchId = searchParams.get("branchId") || "";
    const schoolId = searchParams.get("schoolId") || getSchoolId(auth);
    const academicYearId = searchParams.get("academicYearId") || "";
    const classId = searchParams.get("classId") || searchParams.get("class") || "";
    const sectionId = searchParams.get("sectionId") || searchParams.get("section") || "";
    const paymentMethod = searchParams.get("paymentMode") || searchParams.get("paymentMethod") || "";
    const receiptNo = searchParams.get("receiptNo") || searchParams.get("receiptNumber") || "";
    const createdBy = searchParams.get("createdBy") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    let query: any = db.collection('payments');

    if (schoolId) query = query.where("schoolId", "==", schoolId);
    if (branchId) query = query.where("branchId", "==", branchId);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (classId) query = query.where("classId", "==", classId);
    if (sectionId) query = query.where("sectionId", "==", sectionId);
    if (studentId) {
      query = query.where('studentId', '==', studentId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }
    if (paymentMethod) query = query.where("paymentMethod", "==", paymentMethod);
    if (receiptNo) query = query.where("receiptNumber", "==", receiptNo);
    if (createdBy) query = query.where("recordedBy", "==", createdBy);
    if (dateFrom) query = query.where("createdAt", ">=", new Date(dateFrom));
    if (dateTo) query = query.where("createdAt", "<=", new Date(`${dateTo}T23:59:59.999`));

    query = query.orderBy('createdAt', 'desc');
    if (cursor) {
      const cursorDoc = await db.collection("payments").doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    query = query.limit(pageSize + 1);

    const snapshot = await query.get();
    logFirestoreRead("PaymentsAPI", "payments", snapshot, { schoolId, branchId, academicYearId, classId, sectionId, studentId, status, paymentMethod, receiptNo, pageSize });
    const pageDocs = snapshot.docs.slice(0, pageSize);
    const payments = pageDocs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));
    const nextCursor = snapshot.docs.length > pageSize && pageDocs.length > 0
      ? pageDocs[pageDocs.length - 1].id
      : null;

    return NextResponse.json({ success: true, data: payments, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
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
      userId,
      idempotencyKey
    } = body;

    // Validation
    if (!studentId || !amountPaid || !paymentType || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Idempotency: the client sends a unique key per payment attempt. If the
    // same key is submitted twice (double-click, network retry, future offline
    // sync), the second call returns the FIRST payment instead of creating a
    // duplicate payment/receipt. Key is stored as the doc id of
    // payment_idempotency/{key} and written inside the same transaction.
    const idemKey = typeof idempotencyKey === "string" && /^[\w-]{8,100}$/.test(idempotencyKey)
      ? idempotencyKey
      : null;
    const idemRef = idemKey ? db.collection("payment_idempotency").doc(idemKey) : null;

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const monthKey = `${year}-${month}`;
    const studentRef = db.collection("students").doc(studentId);
    const paymentRef = db.collection("payments").doc();
    const receiptRef = db.collection("receipts").doc();
    const counterRef = db.collection("receipt_counters").doc(monthKey);

    let paymentData: Record<string, unknown> = {};
    let receiptData: Record<string, unknown> = {};
    let receiptNumber = "";
    let existingPaymentId: string | null = null;

    await db.runTransaction(async (transaction) => {
      // All reads first (Firestore transaction rule), including the
      // idempotency marker.
      const [studentSnap, counterSnap, idemSnap] = await Promise.all([
        transaction.get(studentRef),
        transaction.get(counterRef),
        idemRef ? transaction.get(idemRef) : Promise.resolve(null)
      ]);

      // Same key already processed → return the original, write nothing.
      if (idemSnap?.exists) {
        existingPaymentId = String(idemSnap.data()?.paymentId ?? "");
        return;
      }
      if (!studentSnap.exists) throw new Error("Student not found");
      const student = studentSnap.data();
      if (!student) throw new Error("Student data unavailable");

      const nextNumber = Number(counterSnap.data()?.nextNumber ?? 1);
      receiptNumber = `RCP-${year}-${month}-${String(nextNumber).padStart(4, "0")}`;
      const amountDue = Number(student.totalFeesDue || 0);
      const remainingAmount = Math.max(0, amountDue - Number(amountPaid));
      const feeStatus = remainingAmount === 0 ? 'paid' : Number(amountPaid) > 0 ? 'partial' : 'pending';
      const branchId = student.branchId || "default-branch";
      const schoolId = student.schoolId || getSchoolId(auth);
      const academicYearId = student.academicYearId || "";
      const classId = student.classId || student.class || "";
      const sectionId = student.sectionId || student.section || "";

      paymentData = {
        studentId,
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        schoolId,
        branchId,
        academicYearId,
        classId,
        sectionId,
        class: student.class,
        section: student.section,
        amountDue,
        amountPaid: Number(amountPaid),
        remainingAmount,
        paymentType,
        concessionApplied: !!concessionId,
        concessionId: concessionId || null,
        paymentDate: now,
        paymentMethod,
        transactionId: transactionId || null,
        receiptNumber,
        remarks: remarks || null,
        recordedBy: userId || auth.uid,
        status: 'completed',
        createdAt: now,
        updatedAt: now
      };

      receiptData = {
        receiptNumber,
        paymentId: paymentRef.id,
        studentId,
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        schoolId,
        branchId,
        academicYearId,
        classId,
        sectionId,
        class: student.class,
        section: student.section,
        amountPaid: Number(amountPaid),
        paymentDate: now,
        receiptDate: now,
        issuedBy: userId || auth.uid,
        status: 'issued',
        createdAt: now
      };

      if (idemRef) {
        transaction.set(idemRef, {
          paymentId: paymentRef.id,
          receiptNumber,
          studentId,
          amountPaid: Number(amountPaid),
          createdBy: userId || auth.uid,
          createdAt: now
        });
      }
      transaction.set(counterRef, { nextNumber: nextNumber + 1, updatedAt: now }, { merge: true });
      transaction.set(paymentRef, paymentData);
      transaction.set(receiptRef, receiptData);
      transaction.update(studentRef, {
        totalFeesPaid: Number(student.totalFeesPaid || 0) + Number(amountPaid),
        totalFeesDue: remainingAmount,
        feeStatus,
        lastPaymentDate: now,
        feeLastUpdated: now
      });
      transaction.set(db.collection("studentFeeSummaries").doc(`${studentId}_${academicYearId || "default"}`), {
        studentId,
        schoolId,
        branchId,
        academicYearId,
        classId,
        sectionId,
        studentName: student.studentName || "",
        admissionNumber: student.admissionNumber || "",
        phone: student.phone || student.fatherPhone || "",
        className: student.class || classId,
        sectionName: student.section || sectionId,
        totalFee: Number(student.totalFeeAmount || 0),
        totalPaid: Number(student.totalFeesPaid || 0) + Number(amountPaid),
        totalConcession: Number(student.totalConcessionAmount || 0),
        dueAmount: remainingAmount,
        lastPaymentDate: now,
        updatedAt: now
      }, { merge: true });
      transaction.set(db.collection("financeSummaries").doc(`${branchId}_${academicYearId || "default"}_${monthKey}`), {
        branchId,
        schoolId,
        academicYearId,
        month: monthKey,
        totalIncome: FieldValue.increment(Number(amountPaid)),
        totalReceipts: FieldValue.increment(1),
        updatedAt: now
      }, { merge: true });
      transaction.set(db.collection("feeAuditLogs").doc(), {
        action: 'payment_recorded',
        entityType: 'payment',
        entityId: paymentRef.id,
        studentId,
        changes: { oldData: {}, newData: paymentData },
        userId: userId || auth.uid,
        timestamp: now
      });
    });

    // Duplicate submission: return the original payment (HTTP 200, not 201)
    // so retries are safe and no second receipt is ever issued.
    if (existingPaymentId) {
      const existingSnap = await db.collection("payments").doc(existingPaymentId).get();
      return NextResponse.json({
        success: true,
        duplicate: true,
        data: existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : { id: existingPaymentId }
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: paymentRef.id,
          ...paymentData,
          receipt: { ...receiptData, id: receiptRef.id }
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
