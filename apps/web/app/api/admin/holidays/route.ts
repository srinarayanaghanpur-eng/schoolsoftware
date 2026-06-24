import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { Holiday } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc } from "@/lib/apiUtils";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

    const snapshot = await adminDb().collection("holidays").orderBy("date", "desc").limit(100).get();
    return NextResponse.json({ ok: true, holidays: snapshot.docs.map((doc) => serializeDoc<Holiday>(doc)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load holidays";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const date = String(body.date ?? "").trim();
    const type = String(body.type ?? "school").trim();
    if (!title || !date) throw new Error("Holiday title and date are required.");
    if (!["public", "school", "exam", "other"].includes(type)) throw new Error("Invalid holiday type.");

    const docRef = adminDb().collection("holidays").doc(`holiday_${date}`);
    await docRef.set({ title, date, type, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, holiday: { id: docRef.id, title, date, type }, message: "Holiday saved." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save holiday";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
