import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "due_slips";

// GET — recent due-slip history.
export async function GET(req: Request) {
  const auth = await requirePermission(req, "fees.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(200).get();
    const slips = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, slips });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load due slips") }, { status: 500 });
  }
}

const generateSchema = z.object({
  academicYearId: z.string().trim().min(1),
  classId: z.string().trim().optional().default(""),
  sectionId: z.string().trim().optional().default(""),
  dueDate: z.string().trim().optional().default(""),
  studentIds: z.array(z.string().trim().min(1)).max(150).optional()
});

// POST — generate slips for outstanding students (max 150 per run).
export async function POST(req: Request) {
  const auth = await requirePermission(req, "fees.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `due-slip:${auth.uid}`, maxRequests: 10, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 24 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = generateSchema.parse(await req.json());
    const db = adminDb();
    const snap = await db
      .collection("studentFeeSummaries")
      .where("academicYearId", "==", parsed.academicYearId)
      .where("dueAmount", ">", 0)
      .orderBy("dueAmount", "desc")
      .limit(150)
      .get();

    const wanted = parsed.studentIds && parsed.studentIds.length > 0 ? new Set(parsed.studentIds) : null;
    const rows = snap.docs
      .map((doc) => serializeDoc(doc))
      .filter((row) => !row.carriedForwardTo)
      .filter((row) => Math.max(0, Number(row.dueAmount) || 0) > 0)
      .filter((row) => !parsed.classId || String(row.className || row.classId) === parsed.classId)
      .filter((row) => !parsed.sectionId || String(row.sectionName || row.sectionId) === parsed.sectionId)
      .filter((row) => !wanted || wanted.has(String(row.studentId || "")));

    if (rows.length === 0) return json({ ok: true, generated: 0, slips: [] });

    const counterRef = db.collection("counters").doc("due_slips");
    const base = await db.runTransaction(async (tx) => {
      const counter = await tx.get(counterRef);
      const start = Number(counter.data()?.next || 0);
      tx.set(counterRef, { next: start + rows.length, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return start;
    });

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    const created: { id: string; slipNumber: string; studentId: string; amount: number }[] = [];
    rows.forEach((row, index) => {
      const ref = db.collection(COLLECTION).doc();
      const slipNumber = `DS-${new Date().getFullYear()}-${String(base + index + 1).padStart(5, "0")}`;
      const amount = Math.max(0, Number(row.dueAmount) || 0);
      batch.set(ref, {
        slipNumber,
        studentId: String(row.studentId || ""),
        studentName: String(row.studentName || ""),
        admissionNumber: String(row.admissionNumber || ""),
        className: String(row.className || row.classId || ""),
        section: String(row.sectionName || row.sectionId || ""),
        academicYearId: parsed.academicYearId,
        amount,
        total: amount,
        dueDate: parsed.dueDate || "",
        status: "issued",
        schoolId: getSchoolId(auth),
        createdBy: auth.uid,
        createdAt: now,
        updatedAt: now
      });
      created.push({ id: ref.id, slipNumber, studentId: String(row.studentId || ""), amount });
    });
    await batch.commit();

    return json({ ok: true, generated: created.length, slips: created });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to generate due slips") }, { status: 400 });
  }
}
