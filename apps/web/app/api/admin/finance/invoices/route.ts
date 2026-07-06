import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { invoiceCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "invoices";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || getSchoolId(token);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = docCursor(searchParams.get("cursor"));

  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  if (studentId) query = query.where("studentId", "==", studentId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (schoolId) query = query.where("schoolId", "==", schoolId);
  query = query.orderBy("date", "desc");

  if (cursor) {
    const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.limit(pageSize + 1).get();
  logFirestoreRead("FinanceInvoicesAPI", COLLECTION, snap, { studentId, academicYearId, schoolId, pageSize });
  const pageDocs = snap.docs.slice(0, pageSize);
  const invoices = pageDocs.map((d) => serializeDoc(d));
  const nextCursor = snap.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  return NextResponse.json({ ok: true, invoices, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

// POST — generate an invoice with a sequential number (INV-0001…).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = invoiceCreateSchema.parse(body);
    const db = adminDb();
    const total = parsed.items.reduce((sum, it) => sum + it.amount, 0);
    const student = await db.collection("students").doc(parsed.studentId).get();
    const studentData = student.data();
    const academicYearId = String(body.academicYearId ?? studentData?.academicYearId ?? "").trim();
    const schoolId = String(studentData?.schoolId ?? getSchoolId(token));

    // atomic sequential invoice number
    const counterRef = db.collection("counters").doc("invoices");
    const seq = await db.runTransaction(async (tx) => {
      const c = await tx.get(counterRef);
      const next = ((c.data()?.seq as number) || 0) + 1;
      tx.set(counterRef, { seq: next }, { merge: true });
      return next;
    });
    const invoiceNo = `INV-${String(seq).padStart(4, "0")}`;

    const ref = await db.collection(COLLECTION).add({
      invoiceNo,
      studentId: parsed.studentId,
      studentName: (studentData?.studentName as string) || "",
      academicYearId,
      schoolId,
      items: parsed.items,
      total,
      status: "issued",
      date: parsed.date || new Date().toISOString().slice(0, 10),
      createdBy: token.uid,
      createdAt: FieldValue.serverTimestamp()
    });
    return NextResponse.json({ ok: true, id: ref.id, invoiceNo, total });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create invoice" }, { status: 400 });
  }
}
