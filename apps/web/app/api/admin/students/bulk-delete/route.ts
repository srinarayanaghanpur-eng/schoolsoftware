import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { firestoreErrorResponse } from "@/lib/firebaseErrors";

const MAX_IDS = 300;
const BATCH_LIMIT = 400;
const IN_CHUNK = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// POST /api/admin/students/bulk-delete
// Body: { ids: string[] } — permanently deletes the selected student docs and
// their studentFeeSummaries (to avoid orphaned dues). Batched and capped.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "students.delete");
  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids)
      ? Array.from(new Set<string>(body.ids.map((v: unknown) => String(v)).filter((v: string) => Boolean(v)))).slice(0, MAX_IDS)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "No students selected" }, { status: 400 });
    }

    const db = adminDb();

    // 1) Delete the student documents.
    for (const group of chunk(ids, BATCH_LIMIT)) {
      const batch = db.batch();
      group.forEach((id) => batch.delete(db.collection("students").doc(id)));
      await batch.commit();
    }

    // 2) Best-effort: remove their fee summaries so dues/defaulters don't show
    //    ghosts. Queried in `in` chunks to keep reads bounded.
    let summariesDeleted = 0;
    for (const group of chunk(ids, IN_CHUNK)) {
      const snap = await db.collection("studentFeeSummaries").where("studentId", "in", group).get();
      if (snap.empty) continue;
      for (const sub of chunk(snap.docs, BATCH_LIMIT)) {
        const batch = db.batch();
        sub.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        summariesDeleted += sub.length;
      }
    }

    return NextResponse.json({ success: true, deleted: ids.length, summariesDeleted });
  } catch (error) {
    return firestoreErrorResponse(error, "Failed to delete students", 500);
  }
}
