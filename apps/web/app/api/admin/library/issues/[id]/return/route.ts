import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { libraryReturnSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// POST /api/admin/library/issues/[id]/return — return a book (restores copy, records fine).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "library.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { fine } = libraryReturnSchema.parse(await req.json().catch(() => ({})));
    const db = adminDb();
    const issueRef = db.collection("library_issues").doc(params.id);
    const issue = await issueRef.get();
    if (!issue.exists) return NextResponse.json({ ok: false, error: "Issue not found" }, { status: 404 });
    if (issue.data()?.status === "returned") return NextResponse.json({ ok: false, error: "Already returned" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const bookRef = db.collection("books").doc(issue.data()?.bookId as string);
    const book = await bookRef.get();
    const batch = db.batch();
    if (book.exists) batch.update(bookRef, { available: ((book.data()?.available as number) || 0) + 1, updatedAt: now });
    batch.update(issueRef, { status: "returned", returnDate: new Date().toISOString().slice(0, 10), fine });
    await batch.commit();
    return NextResponse.json({ ok: true, fine });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
