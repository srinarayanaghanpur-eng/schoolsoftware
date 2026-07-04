import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { invoiceCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "invoices";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const studentId = new URL(req.url).searchParams.get("studentId");
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (studentId) query = query.where("studentId", "==", studentId);
  // Hard read cap to keep query cost bounded (Firestore free-tier quota).
  const snap = await query.limit(500).get();
  const invoices = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, invoices });
}

// POST — generate an invoice with a sequential number (INV-0001…).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = invoiceCreateSchema.parse(await req.json());
    const db = adminDb();
    const total = parsed.items.reduce((sum, it) => sum + it.amount, 0);
    const student = await db.collection("students").doc(parsed.studentId).get();

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
      studentName: (student.data()?.studentName as string) || "",
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
