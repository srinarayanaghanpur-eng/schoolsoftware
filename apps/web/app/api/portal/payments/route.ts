import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizePortalRequest,
  getPortalLinkedStudents,
  resolveLinkedStudentId,
  verifyStudentLinked
} from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const access = await authorizePortalRequest(req);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.status === 401 ? "Authentication required" : "Portal access denied" },
      { status: access.status }
    );
  }
  const { token } = access;

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId");

  const linkedStudents = await getPortalLinkedStudents(token);
  if (linkedStudents.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const studentId = resolveLinkedStudentId(linkedStudents, requestedStudentId);
  if (!studentId) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const valid = await verifyStudentLinked(token, studentId);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const paymentsSnap = await db
    .collection("payments")
    .where("studentId", "==", studentId)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const payments = paymentsSnap.docs.map((doc) => {
    const p = doc.data();
    return {
      id: doc.id,
      amountPaid: p.amountPaid || 0,
      paymentType: p.paymentType || "",
      paymentMethod: p.paymentMethod || "",
      transactionId: p.transactionId || "",
      status: p.status || "completed",
      receiptNumber: p.receiptNumber || "",
      createdAt: p.createdAt?.toDate?.()?.toISOString() || p.createdAt || "",
    };
  });

  return NextResponse.json({ ok: true, payments, linkedStudents });
}
