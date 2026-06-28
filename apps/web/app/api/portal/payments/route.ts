import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const userDoc = await db.collection("users").doc(token.uid).get();
  const studentIds: string[] = (userDoc.data()?.studentIds as string[]) || [];
  if (studentIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked to this account" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("studentId");
  const studentId = requested && studentIds.includes(requested) ? requested : studentIds[0];

  const studentSnaps = await Promise.all(
    studentIds.map((id) => db.collection("students").doc(id).get())
  );
  const linkedStudents = studentSnaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const s = snap.data() as Record<string, unknown>;
      return { id: snap.id, name: String(s.studentName || ""), className: String(s.class || "") };
    });

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

  return NextResponse.json({ ok: true, payments, linkedStudentIds: studentIds, linkedStudents });
}
