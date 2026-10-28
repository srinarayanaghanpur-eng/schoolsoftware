import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentConfirmSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { roleHasPermission } from "@/lib/rbacAdmin";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";
import { buildReceiptRecord, generateReceiptNumber, resolveAcademicYearLabel } from "@/lib/receiptService";
import { recalculateStudentFeeSummary } from "@/lib/feeRecalculation";
import { resolveFeeState } from "@/lib/feeModel";

// POST /api/fees/confirm — staff-only finalization of a collected fee payment.
export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(token);
  // 30 confirms/min per user — duplicate confirms are idempotent, this bounds abuse.
  const limit = await checkRateLimit({ key: `fees_confirm:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  if (!(await roleHasPermission(role, "fees.create"))) {
    return NextResponse.json(
      { ok: false, error: "Fee payments can only be recorded by school staff." },
      { status: 403 }
    );
  }

  try {
    const parsed = paymentConfirmSchema.parse(await req.json());
    const db = adminDb();
    const orderRef = db.collection("payment_orders").doc(parsed.orderId);
    // Pre-authz (outside transaction): IDOR + parent linkage.
    const preSnap = await orderRef.get();
    if (!preSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
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

      const order = orderSnap.data() as { studentId: string; amount: number; paymentType: string; feeType?: string; status: string; note?: string; paymentId?: string; receiptId?: string; receiptNumber?: string; createdBy?: string };
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

      const fee = resolveFeeState(student as Record<string, unknown>);
      const amountDue = fee.due;
      if (fee.status === "paid" || amountDue <= 0) {
        throw new Error("This student has already paid the full fee. No due amount pending.");
      }
      if (amountPaid > amountDue) {
        throw new Error(`Payment amount cannot be greater than pending due of ₹${amountDue.toLocaleString("en-IN")}.`);
      }

      const remainingAmount = Math.max(0, amountDue - amountPaid);
      const totalPaid = fee.paid + amountPaid;
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
        feeType: order.feeType || order.paymentType || "tuition",
        paymentMethod: parsed.method || "cash",
        transactionId: parsed.transactionId || orderSnap.id,
        receiptId: receiptRef.id,
        receiptNumber,
        remarks: order.note || null,
        status: "completed",
        source: "manual",
        paidBy: token.uid,
        paidByName: token.name ?? token.uid,
        recordedBy: token.uid,
        transactionType: "income",
        voucherType: "receipt",
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
        totalFeesPaid: totalPaid,
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
        totalFee: fee.payableFee,
        totalPaid,
        totalConcession: fee.concession,
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
