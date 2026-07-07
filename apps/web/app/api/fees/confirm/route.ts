import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentConfirmSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getSchoolId } from "@/lib/schoolScope";
import { buildReceiptRecord, generateReceiptNumber, resolveAcademicYearLabel } from "@/lib/receiptService";
import { validatePaymentAllowed, recalculateStudentFeeSummary } from "@/lib/feeRecalculation";

// POST /api/fees/confirm — finalize a payment order: mark paid, record the payment,
// and update the student's fee totals. (A real gateway would verify a signature here.)
export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  try {
    const parsed = paymentConfirmSchema.parse(await req.json());
    const db = adminDb();
    const orderRef = db.collection("payment_orders").doc(parsed.orderId);
    const paymentRef = db.collection("payments").doc();
    const receiptRef = db.collection("receipts").doc();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const monthKey = `${year}-${month}`;

    let amountPaid = 0;
    let receiptNumber = "";
    let receiptId = receiptRef.id;
    let paymentId = paymentRef.id;
    let orderStudentId = "";
    // Idempotency: confirming the same order twice (double-click, network
    // retry) returns the FIRST payment instead of erroring or duplicating.
    let existingPaymentId: string | null = null;

    await db.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw new Error("Order not found");

      const order = orderSnap.data() as { studentId: string; amount: number; paymentType: string; status: string; note?: string; paymentId?: string; receiptId?: string; receiptNumber?: string };
      orderStudentId = order.studentId;
      if (order.status === "paid") {
        existingPaymentId = String(order.paymentId ?? "");
        paymentId = existingPaymentId;
        receiptId = String(order.receiptId || order.paymentId || "");
        receiptNumber = String(order.receiptNumber ?? "");
        amountPaid = Number(order.amount) || 0;
        return; // no writes — original payment stands
      }

      const studentRef = db.collection("students").doc(order.studentId);
      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists) throw new Error("Student not found");
      const student = studentSnap.data() ?? {};

      amountPaid = Number(order.amount) || 0;

      // Validate: check if student has pending balance before processing.
      const sFeeStatus = String(student.feeStatus || "pending");
      const sTotalFeesDue = Number(student.totalFeesDue ?? 0);
      const sTotalFeesPaid = Number(student.totalFeesPaid || 0);
      if (sFeeStatus === "paid" || (sTotalFeesDue <= 0 && sTotalFeesPaid > 0)) {
        throw new Error("This student has already paid the full fee. No due amount pending.");
      }
      if (amountPaid > sTotalFeesDue) {
        throw new Error(`Payment amount cannot be greater than pending due of ₹${sTotalFeesDue.toLocaleString("en-IN")}.`);
      }

      const amountDue = Number(student.totalFeesDue ?? 0);
      const remainingAmount = Math.max(0, amountDue - amountPaid);
      const totalPaid = Number(student.totalFeesPaid || 0) + amountPaid;
      const feeStatus: "paid" | "partial" | "pending" = remainingAmount <= 0 ? "paid" : amountPaid > 0 ? "partial" : "pending";
      const schoolId = String(student.schoolId || getSchoolId(token));
      const branchId = String(student.branchId || "default-branch");
      const academicYearId = String(student.academicYearId || "");
      const classId = String(student.classId || student.class || "");
      const sectionId = String(student.sectionId || student.section || "");
      const academicYear = await resolveAcademicYearLabel(db, academicYearId, String(student.academicYear || ""), transaction);
      receiptNumber = await generateReceiptNumber(db, academicYear, transaction);

      const paymentData = {
        studentId: order.studentId,
        admissionNumber: student.admissionNumber || "",
        studentName: student.studentName || "",
        schoolId,
        branchId,
        academicYearId,
        classId,
        sectionId,
        class: student.class || classId,
        section: student.section || sectionId,
        amountDue,
        amountPaid,
        remainingAmount,
        paymentType: order.paymentType,
        paymentMethod: parsed.method || "cash",
        transactionId: parsed.transactionId || orderSnap.id,
        receiptId: receiptRef.id,
        receiptNumber,
        remarks: order.note || null,
        status: "completed",
        source: "online",
        paidBy: token.uid,
        paidByName: token.name ?? token.uid,
        recordedBy: token.uid,
        paymentDate: now,
        createdAt: now,
        updatedAt: now
      };
      const receiptData = buildReceiptRecord({
        receiptId: receiptRef.id,
        receiptNo: receiptNumber,
        paymentId: paymentRef.id,
        academicYear,
        payment: paymentData,
        student,
        createdByUserId: token.uid,
        createdByUsername: token.name ?? token.email ?? token.uid,
        createdAt: now
      });

      transaction.set(paymentRef, paymentData);
      transaction.set(receiptRef, receiptData);
      transaction.set(studentRef, {
        totalFeesPaid: FieldValue.increment(amountPaid),
        totalFeesDue: remainingAmount,
        feeStatus,
        lastPaymentDate: now,
        feeLastUpdated: now
      }, { merge: true });
      // Record which payment/receipt this order produced so a duplicate
      // confirm can return the original.
      transaction.update(orderRef, { status: "paid", paymentId: paymentRef.id, receiptId: receiptRef.id, receiptNumber, updatedAt: now });
      transaction.set(db.collection("studentFeeSummaries").doc(`${order.studentId}_${academicYearId || "default"}`), {
        studentId: order.studentId,
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
        totalPaid,
        totalConcession: Number(student.totalConcessionAmount || 0),
        dueAmount: remainingAmount,
        feeStatus,
        lastPaymentDate: now,
        updatedAt: now
      }, { merge: true });
      transaction.set(db.collection("financeSummaries").doc(`${branchId}_${academicYearId || "default"}_${monthKey}`), {
        branchId,
        schoolId,
        academicYearId,
        month: monthKey,
        totalIncome: FieldValue.increment(amountPaid),
        totalReceipts: FieldValue.increment(1),
        updatedAt: now
      }, { merge: true });
    });

    if (orderStudentId) {
      recalculateStudentFeeSummary(orderStudentId).catch((err) => {
        console.error(`[FeeConfirm] Recalculation failed for ${orderStudentId}:`, err);
      });
    }

    if (existingPaymentId !== null) {
      return NextResponse.json({ ok: true, duplicate: true, paymentId, receiptId, receiptNumber, amount: amountPaid });
    }

    return NextResponse.json({ ok: true, paymentId: paymentRef.id, receiptId: receiptRef.id, receiptNumber, amount: amountPaid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm payment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
