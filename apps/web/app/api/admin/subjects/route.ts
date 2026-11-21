import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "subjects";

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(30).optional().default(""),
  className: z.string().trim().max(50).optional().default(""),
  academicYearId: z.string().trim().max(100).optional().default("")
});

export async function GET(req: Request) {
  const auth = await requirePermission(req, "academics.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const className = String(searchParams.get("class") || "").trim();
  const academicYearId = String(searchParams.get("academicYearId") || "").trim();

  try {
    let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
    if (className) query = query.where("className", "==", className);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    const snap = await query.limit(500).get();
    const subjects = snap.docs
      .map((doc) => serializeDoc(doc))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return json({ ok: true, subjects });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load subjects") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "academics.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `subjects-create:${auth.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 8 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = subjectSchema.parse(await req.json());
    const schoolId = getSchoolId(auth);
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      schoolId,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to create subject") }, { status: 400 });
  }
}
