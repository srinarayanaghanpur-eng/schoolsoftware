import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { bankTxnSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

// GET — transactions for an account.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection("bank_transactions").where("accountId", "==", params.id).get();
  const transactions = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, transactions });
}

// POST — deposit / withdrawal / transfer. Updates account balance(s).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const txn = bankTxnSchema.parse(await req.json());
    const db = adminDb();
    const accRef = db.collection("bank_accounts").doc(params.id);
    const accSnap = await accRef.get();
    if (!accSnap.exists) return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });

    const now = FieldValue.serverTimestamp();
    const bal = (accSnap.data()?.currentBalance as number) || 0;
    const batch = db.batch();

    if (txn.type === "deposit") {
      batch.update(accRef, { currentBalance: bal + txn.amount, updatedAt: now });
    } else if (txn.type === "withdrawal") {
      batch.update(accRef, { currentBalance: bal - txn.amount, updatedAt: now });
    } else {
      // transfer to another account
      if (!txn.toAccountId) return NextResponse.json({ ok: false, error: "toAccountId required for transfer" }, { status: 400 });
      const toRef = db.collection("bank_accounts").doc(txn.toAccountId);
      const toSnap = await toRef.get();
      if (!toSnap.exists) return NextResponse.json({ ok: false, error: "Destination account not found" }, { status: 404 });
      batch.update(accRef, { currentBalance: bal - txn.amount, updatedAt: now });
      batch.update(toRef, { currentBalance: ((toSnap.data()?.currentBalance as number) || 0) + txn.amount, updatedAt: now });
    }

    const txnRef = db.collection("bank_transactions").doc();
    batch.set(txnRef, { ...txn, accountId: params.id, createdBy: token.uid, createdAt: now });
    await batch.commit();
    return NextResponse.json({ ok: true, id: txnRef.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to record transaction" }, { status: 400 });
  }
}
