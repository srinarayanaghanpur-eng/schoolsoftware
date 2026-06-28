import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { getLinkedStudentIds } from "@/lib/portalHelpers";

export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const studentIds = await getLinkedStudentIds(token);

  const paySnap = await db.collection("payments").doc(params.paymentId).get();
  if (!paySnap.exists) return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  const p = paySnap.data() as Record<string, unknown>;

  if (!studentIds.includes(String(p.studentId || ""))) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const studentSnap = p.studentId ? await db.collection("students").doc(String(p.studentId)).get() : null;
  const s = studentSnap?.data() as Record<string, unknown> | undefined;
  const settingsSnap = await db.collection("settings").doc("school").get();
  const schoolName = (settingsSnap.data()?.schoolName as string) || DEFAULT_SETTINGS.schoolName;
  const schoolAddress = (settingsSnap.data()?.address as string) || "";

  const createdAt = p.createdAt;
  const dateStr = createdAt
    ? typeof createdAt === "object" && typeof (createdAt as { toDate?: () => Date }).toDate === "function"
      ? (createdAt as { toDate: () => Date }).toDate().toISOString()
      : String(createdAt)
    : "";

  return NextResponse.json({
    ok: true,
    receipt: {
      receiptNo: p.receiptNumber || params.paymentId,
      paymentId: params.paymentId,
      schoolName,
      schoolAddress,
      date: dateStr.slice(0, 10),
      student: s
        ? {
            id: p.studentId,
            name: s.studentName || "",
            admissionNo: s.admissionNumber || "",
            className: s.class || "",
            section: s.section || "",
            fatherName: s.fatherName || "",
          }
        : null,
      amount: Number(p.amountPaid) || 0,
      paymentType: p.paymentType || "",
      paymentMethod: p.paymentMethod || "",
      transactionId: p.transactionId || "",
      status: p.status || "completed",
    },
  });
}
