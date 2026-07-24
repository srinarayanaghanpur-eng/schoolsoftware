import { FieldValue } from "firebase-admin/firestore";
import { invoiceCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "invoices";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || "";
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = searchParams.get("cursor")?.trim() || "";

    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    else if (studentId) query = query.where("studentId", "==", studentId);
    else if (schoolId) query = query.where("schoolId", "==", schoolId);

    const snap = await query.limit(500).get();
    logFirestoreRead("FinanceInvoicesAPI", COLLECTION, snap, { studentId, academicYearId, schoolId, pageSize });

    const filtered = snap.docs
      .map((doc) => serializeDoc(doc))
      .filter((invoice) => !academicYearId || String(invoice.academicYearId || "") === academicYearId)
      .filter((invoice) => !studentId || String(invoice.studentId || "") === studentId)
      .filter((invoice) => !schoolId || String(invoice.schoolId || "") === schoolId)
      .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));

    const startIndex = cursor ? Math.max(0, filtered.findIndex((item) => item.id === cursor) + 1) : 0;
    const invoices = filtered.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + pageSize < filtered.length && invoices.length > 0 ? invoices[invoices.length - 1].id : null;
    return json({ ok: true, invoices, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load invoices";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// POST — generate an invoice with a sequential number (INV-0001…).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

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
    return json({ ok: true, id: ref.id, invoiceNo, total });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unable to create invoice" }, { status: 400 });
  }
}

