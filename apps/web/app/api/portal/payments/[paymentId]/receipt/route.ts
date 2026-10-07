import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizePortalRequest, getLinkedStudentIds } from "@/lib/portalHelpers";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  const access = await authorizePortalRequest(req);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.status === 401 ? "Authentication required" : "Portal access denied" },
      { status: access.status }
    );
  }
  const { token } = access;

  // Receipts are sensitive documents — throttle per account.
  const receiptLimit = await checkRateLimit({
    key: `portal-receipt:${token.uid}`,
    maxRequests: 60,
    windowMinutes: 1
  });
  if (!receiptLimit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
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
