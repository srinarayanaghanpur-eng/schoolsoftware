import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentConfirmSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

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
    const counterRef = db.collection("receipt_counters").doc(monthKey);

    let amountPaid = 0;
    let receiptNumber = "";

    await db.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw new Error("Order not found");

      const order = orderSnap.data() as { studentId: string; amount: number; paymentType: string; status: string; note?: string };
      if (order.status === "paid") throw new Error("Order already paid");

      const studentRef = db.collection("students").doc(order.studentId);
      const [studentSnap, counterSnap] = await Promise.all([
        transaction.get(studentRef),
        transaction.get(counterRef)
      ]);
      if (!studentSnap.exists) throw new Error("Student not found");
      const student = studentSnap.data() ?? {};

      amountPaid = Number(order.amount) || 0;
      const nextNumber = Number(counterSnap.data()?.nextNumber ?? 1);
      receiptNumber = `RCP-${year}-${month}-${String(nextNumber).padStart(4, "0")}`;
      const amountDue = Number(student.totalFeesDue || student.totalFeeAmount || 0);
      const remainingAmount = Math.max(0, amountDue - amountPaid);
      const totalPaid = Number(student.totalFeesPaid || 0) + amountPaid;
      const feeStatus = remainingAmount === 0 ? "paid" : amountPaid > 0 ? "partial" : "pending";
      const branchId = String(student.branchId || "default-branch");
      const academicYearId = String(student.academicYearId || "");
      const classId = String(student.classId || student.class || "");
      const sectionId = String(student.sectionId || student.section || "");

      const paymentData = {
        studentId: order.studentId,
        admissionNumber: student.admissionNumber || "",
        studentName: student.studentName || "",
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

      transaction.set(counterRef, { nextNumber: nextNumber + 1, updatedAt: now }, { merge: true });
      transaction.set(paymentRef, paymentData);
      transaction.set(receiptRef, {
        receiptNumber,
        paymentId: paymentRef.id,
        studentId: order.studentId,
        admissionNumber: student.admissionNumber || "",
        studentName: student.studentName || "",
        branchId,
        academicYearId,
        classId,
        sectionId,
        class: student.class || classId,
        section: student.section || sectionId,
        amountPaid,
        paymentDate: now,
        receiptDate: now,
        issuedBy: token.uid,
        status: "issued",
        createdAt: now
      });
      transaction.set(studentRef, {
        totalFeesPaid: FieldValue.increment(amountPaid),
        totalFeesDue: remainingAmount,
        feeStatus,
        lastPaymentDate: now,
        feeLastUpdated: now
      }, { merge: true });
      transaction.update(orderRef, { status: "paid", updatedAt: now });
      transaction.set(db.collection("studentFeeSummaries").doc(`${order.studentId}_${academicYearId || "default"}`), {
        studentId: order.studentId,
        branchId,
        academicYearId,
        classId,
        sectionId,
        studentName: student.studentName || "",
        admissionNumber: student.admissionNumber || "",
        className: student.class || classId,
        sectionName: student.section || sectionId,
        totalFee: Number(student.totalFeeAmount || 0),
        totalPaid,
        totalConcession: Number(student.totalConcessionAmount || 0),
        dueAmount: remainingAmount,
        lastPaymentDate: now,
        updatedAt: now
      }, { merge: true });
      transaction.set(db.collection("financeSummaries").doc(`${branchId}_${academicYearId || "default"}_${monthKey}`), {
        branchId,
        academicYearId,
        month: monthKey,
        totalIncome: FieldValue.increment(amountPaid),
        totalReceipts: FieldValue.increment(1),
        updatedAt: now
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, receiptId: paymentRef.id, receiptNumber, amount: amountPaid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm payment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
