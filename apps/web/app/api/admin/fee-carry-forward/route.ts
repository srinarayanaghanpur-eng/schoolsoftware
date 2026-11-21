import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

const SUMMARIES = "studentFeeSummaries";

function summaryId(studentId: string, academicYearId: string) {
  return `${studentId}_${academicYearId || "default"}`;
}

// GET — preview dues that can be carried from one academic year to the next.
export async function GET(req: Request) {
  const auth = await requirePermission(req, "fees.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const source = String(searchParams.get("sourceAcademicYearId") || "").trim();
  const target = String(searchParams.get("targetAcademicYearId") || "").trim();
  if (!source) return json({ ok: false, error: "Source academic year is required" }, { status: 400 });
  if (target && target === source) {
    return json({ ok: false, error: "Source and target years must differ" }, { status: 400 });
  }

  try {
    const snap = await adminDb()
      .collection(SUMMARIES)
      .where("academicYearId", "==", source)
      .where("dueAmount", ">", 0)
      .orderBy("dueAmount", "desc")
      .limit(300)
      .get();

    const students = snap.docs
      .map((doc) => serializeDoc(doc))
      .filter((row) => !row.carriedForwardTo)
      .map((row) => ({
        studentId: String(row.studentId || ""),
        studentName: String(row.studentName || ""),
        admissionNumber: String(row.admissionNumber || ""),
        className: String(row.className || row.classId || ""),
        sectionName: String(row.sectionName || row.sectionId || ""),
        dueAmount: Math.max(0, Number(row.dueAmount) || 0)
      }))
      .filter((row) => row.studentId && row.dueAmount > 0);

    const byClass = new Map<string, { className: string; count: number; totalDue: number }>();
    let totalDue = 0;
    for (const student of students) {
      totalDue += student.dueAmount;
      const entry = byClass.get(student.className) ?? { className: student.className || "—", count: 0, totalDue: 0 };
      entry.count += 1;
      entry.totalDue += student.dueAmount;
      byClass.set(student.className, entry);
    }

    return json({
      ok: true,
      students,
      totals: { students: students.length, totalDue },
      byClass: Array.from(byClass.values()).sort((a, b) => a.className.localeCompare(b.className)),
      truncated: snap.size >= 300
    });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to preview carry-forward") }, { status: 500 });
  }
}

const applySchema = z.object({
  sourceAcademicYearId: z.string().trim().min(1),
  targetAcademicYearId: z.string().trim().min(1),
  studentIds: z.array(z.string().trim().min(1)).min(1).max(200)
});

// POST — move outstanding dues into the target year's summary.
export async function POST(req: Request) {
  const auth = await requirePermission(req, "fees.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `carry-forward:${auth.uid}`, maxRequests: 10, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 32 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = applySchema.parse(await req.json());
    if (parsed.sourceAcademicYearId === parsed.targetAcademicYearId) {
      return json({ ok: false, error: "Source and target years must differ" }, { status: 400 });
    }

    const db = adminDb();
    const ids = Array.from(new Set(parsed.studentIds));
    const sourceRefs = ids.map((id) => db.collection(SUMMARIES).doc(summaryId(id, parsed.sourceAcademicYearId)));
    const targetRefs = ids.map((id) => db.collection(SUMMARIES).doc(summaryId(id, parsed.targetAcademicYearId)));

    const sourceDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    const targetDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      sourceDocs.push(...(await db.getAll(...sourceRefs.slice(i, i + 100))));
      targetDocs.push(...(await db.getAll(...targetRefs.slice(i, i + 100))));
    }

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    let applied = 0;
    let totalCarried = 0;
    let skipped = 0;

    ids.forEach((studentId, index) => {
      const sourceDoc = sourceDocs[index];
      const targetDoc = targetDocs[index];
      const sourceData = sourceDoc?.exists ? sourceDoc.data() || {} : null;
      const carried = Math.max(0, Number(sourceData?.dueAmount) || 0);
      if (!sourceData || carried <= 0 || sourceData.carriedForwardTo) {
        skipped += 1;
        return;
      }
      const targetData = targetDoc?.exists ? targetDoc.data() || {} : {};
      const targetDue = Math.max(0, Number(targetData.dueAmount) || 0);
      const targetTotalFee = Number(targetData.totalFee) || 0;
      const targetCarried = Number(targetData.carriedForwardAmount) || 0;
      const newDue = targetDue + carried;
      batch.set(
        db.collection(SUMMARIES).doc(summaryId(studentId, parsed.targetAcademicYearId)),
        {
          studentId,
          academicYearId: parsed.targetAcademicYearId,
          schoolId: targetData.schoolId || sourceData.schoolId || "",
          branchId: targetData.branchId || sourceData.branchId || "default-branch",
          classId: targetData.classId || sourceData.classId || "",
          sectionId: targetData.sectionId || sourceData.sectionId || "",
          studentName: targetData.studentName || sourceData.studentName || "",
          admissionNumber: targetData.admissionNumber || sourceData.admissionNumber || "",
          phone: targetData.phone || sourceData.phone || "",
          className: targetData.className || sourceData.className || "",
          sectionName: targetData.sectionName || sourceData.sectionName || "",
          totalFee: targetTotalFee + carried,
          totalPaid: Number(targetData.totalPaid) || 0,
          totalConcession: Number(targetData.totalConcession) || 0,
          dueAmount: newDue,
          feeStatus: newDue > 0 ? "pending" : "paid",
          carriedForwardAmount: targetCarried + carried,
          carriedFromAcademicYearId: parsed.sourceAcademicYearId,
          updatedAt: now
        },
        { merge: true }
      );
      batch.update(sourceDoc.ref, {
        originalDueAmount: carried,
        dueAmount: 0,
        feeStatus: "carried_forward",
        carriedForwardTo: parsed.targetAcademicYearId,
        carriedForwardAt: now,
        updatedAt: now
      });
      applied += 1;
      totalCarried += carried;
    });

    if (applied > 0) await batch.commit();
    return json({ ok: true, applied, skipped, totalCarried });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to carry forward dues") }, { status: 400 });
  }
}
