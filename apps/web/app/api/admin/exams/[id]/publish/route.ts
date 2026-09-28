import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, requirePermission, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

// POST /api/admin/exams/[id]/publish — publish results (status = "published").
// Requires the approve permission (principal/admin).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.approve");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  // Publishing is irreversible from the UI — throttle accidental double-clicks.
  const limit = await checkRateLimit({ key: `exam-publish:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 1024);
  if (bodyLimit) return bodyLimit;

  const ref = adminDb().collection("exams").doc(params.id);
  if (!(await ref.get()).exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });
  await ref.update({ status: "published", updatedAt: FieldValue.serverTimestamp() });
  return json({ ok: true });
}

