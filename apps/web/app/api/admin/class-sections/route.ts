import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { firestoreErrorResponse } from "@/lib/firebaseErrors";
import {
  CLASS_IDS,
  CLASS_SECTION_SETTINGS_DOC,
  DEFAULT_SECTIONS,
  MAX_SECTIONS_PER_CLASS,
  defaultSectionsByClass,
  sanitizeSections
} from "@/lib/classSections";

// GET /api/admin/class-sections — sections configured per class (defaults A/B).
export async function GET(req: Request) {
  const token = await requirePermission(req, "students.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection("settings").doc(CLASS_SECTION_SETTINGS_DOC).get();
    const stored = (snap.exists ? snap.data()?.sections : null) as Record<string, unknown> | null;
    const sections = defaultSectionsByClass();
    if (stored) {
      for (const classId of CLASS_IDS) {
        const cleaned = sanitizeSections(stored[classId]);
        if (cleaned) sections[classId] = cleaned;
      }
    }
    return NextResponse.json({ ok: true, sections });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to load class sections");
  }
}

// PUT /api/admin/class-sections — replace the section list for one class.
// Body: { classId, sections: string[] }. Deleting a section that still has
// students is rejected — merge them first.
export async function PUT(req: Request) {
  const token = await requirePermission(req, "students.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "");
    if (!CLASS_IDS.includes(classId)) {
      return NextResponse.json({ ok: false, error: "Unknown class" }, { status: 400 });
    }
    const sections = sanitizeSections(body?.sections);
    if (!sections) {
      return NextResponse.json(
        { ok: false, error: `Sections must be 1-${MAX_SECTIONS_PER_CLASS} short letters (A, B, C1...)` },
        { status: 400 }
      );
    }

    const db = adminDb();
    const ref = db.collection("settings").doc(CLASS_SECTION_SETTINGS_DOC);
    const snap = await ref.get();
    const stored = (snap.exists ? snap.data()?.sections : null) as Record<string, unknown> | null;
    const current = sanitizeSections(stored?.[classId]) ?? [...DEFAULT_SECTIONS];

    // Block removal of sections that still contain students (1 aggregate read each).
    const removed = current.filter((s) => !sections.includes(s));
    for (const section of removed) {
      const countSnap = await db.collection("students")
        .where("class", "==", classId)
        .where("section", "==", section)
        .count()
        .get();
      const count = Number(countSnap.data().count || 0);
      if (count > 0) {
        return NextResponse.json(
          { ok: false, error: `Section ${section} still has ${count} student(s). Merge them into another section first.` },
          { status: 409 }
        );
      }
    }

    await ref.set(
      { sections: { [classId]: sections }, updatedAt: FieldValue.serverTimestamp(), updatedBy: token.uid },
      { mergeFields: [`sections.${classId}`, "updatedAt", "updatedBy"] }
    );
    return NextResponse.json({ ok: true, classId, sections });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to save class sections", 400);
  }
}
