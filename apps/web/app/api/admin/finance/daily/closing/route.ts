import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

const COLLECTION = "daily_closings";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  if (from) query = query.where("date", ">=", from);
  if (to) query = query.where("date", "<=", to);
  const snap = await query.get();
  const closings = snap.docs.map((d) => ({ id: d.id, ...d.data(), date: String(d.data().date) }));
  return NextResponse.json({ ok: true, closings });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.approve");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { date, action } = await req.json();
    if (!date || !["close", "open"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid request. Need date + action (close|open)" }, { status: 400 });
    }

    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    const existing = await db.collection(COLLECTION).where("date", "==", date).get();

    if (action === "close") {
      if (existing.empty) {
        await db.collection(COLLECTION).add({ date, closedAt: now, closedBy: token.uid });
      } else {
        await existing.docs[0].ref.update({ closedAt: now, closedBy: token.uid });
      }
    } else {
      if (!existing.empty) {
        await existing.docs[0].ref.delete();
      }
    }

    return NextResponse.json({ ok: true, date, closed: action === "close" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
