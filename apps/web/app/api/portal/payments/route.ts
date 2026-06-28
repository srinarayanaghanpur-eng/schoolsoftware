import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId");

  const linkedStudents = await getPortalLinkedStudents(token);
  if (linkedStudents.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const studentId = requestedStudentId && linkedStudents.some((s) => s.id === requestedStudentId)
    ? requestedStudentId
    : linkedStudents[0].id;

  const valid = await verifyStudentLinked(token, studentId);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const paymentsSnap = await db
    .collection("payments")
    .where("studentId", "==", studentId)
    .orderBy("createdAt", "desc")
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
