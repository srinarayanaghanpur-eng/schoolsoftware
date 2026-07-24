import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { firestoreErrorResponse } from "@/lib/firebaseErrors";
import {
  CLASS_IDS,
  CLASS_SECTION_SETTINGS_DOC,
  DEFAULT_SECTIONS,
  normalizeSection,
  sanitizeSections
} from "@/lib/classSections";

const BATCH_LIMIT = 400;

// POST /api/admin/class-sections/merge
// Body: { classId, fromSection, toSection, keepFromSection? }
// Moves every student of classId/fromSection into toSection (students +
// studentFeeSummaries), then removes fromSection from the class's section
// list unless keepFromSection is true.
export async function POST(req: Request) {
  const token = await requirePermission(req, "students.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "");
    const fromSection = normalizeSection(body?.fromSection);
    const toSection = normalizeSection(body?.toSection);
    const keepFromSection = Boolean(body?.keepFromSection);

    if (!CLASS_IDS.includes(classId)) {
      return json({ ok: false, error: "Unknown class" }, { status: 400 });
    }
    if (!fromSection || !toSection || fromSection === toSection) {
      return json({ ok: false, error: "Pick two different sections to merge" }, { status: 400 });
    }

    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    let movedStudents = 0;
    let movedSummaries = 0;

    // Move students in pages of BATCH_LIMIT until the source section is empty.
    // Each pass re-queries because the previous batch changed the section field.
    for (;;) {
      const snap = await db.collection("students")
        .where("class", "==", classId)
        .where("section", "==", fromSection)
        .limit(BATCH_LIMIT)
        .get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, { section: toSection, sectionId: toSection, updatedAt: now });
      });
      await batch.commit();
      movedStudents += snap.size;
      if (snap.size < BATCH_LIMIT) break;
    }

    // Keep fee summaries in step so dues/defaulters group under the new section.
    for (;;) {
      const snap = await db.collection("studentFeeSummaries")
        .where("classId", "==", classId)
        .where("sectionId", "==", fromSection)
        .limit(BATCH_LIMIT)
        .get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, { sectionId: toSection, sectionName: toSection, updatedAt: now });
      });
      await batch.commit();
      movedSummaries += snap.size;
      if (snap.size < BATCH_LIMIT) break;
    }

    // Update the configured section list (drop the emptied source section).
    const ref = db.collection("settings").doc(CLASS_SECTION_SETTINGS_DOC);
    const configSnap = await ref.get();
    const stored = (configSnap.exists ? configSnap.data()?.sections : null) as Record<string, unknown> | null;
    const current = sanitizeSections(stored?.[classId]) ?? [...DEFAULT_SECTIONS];
    const next = Array.from(new Set(
      current.filter((s) => keepFromSection || s !== fromSection).concat(toSection)
    )).sort();
    await ref.set(
      { sections: { [classId]: next }, updatedAt: now, updatedBy: token.uid },
      { mergeFields: [`sections.${classId}`, "updatedAt", "updatedBy"] }
    );

    return json({
      ok: true,
      classId,
      fromSection,
      toSection,
      movedStudents,
      movedSummaries,
      sections: next
    });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to merge sections", 400);
  }
}
