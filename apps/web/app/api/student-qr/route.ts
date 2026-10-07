import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, enforceBodyLimit, json } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

/**
 * Single source of truth for how long an issued QR token stays valid.
 * The client derives its re-issue threshold from `expiresInMs` in the response.
 */
const QR_TOKEN_TTL_MS = 10 * 60 * 1000;

/** 192-bit random token, base64url => exactly 32 characters. */
function issueToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * POST /api/student-qr
 * Issues an opaque token that encodes NO student PII. The details are read
 * server-side from the canonical student document and stored keyed by the
 * token, so the QR/URL only ever carries the capability.
 */
export async function POST(req: Request) {
  try {
    const auth = await requirePermission(req, "students.view");
    if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const limit = await checkRateLimit({
      key: `student_qr_issue:${auth.uid}`,
      maxRequests: 60,
      windowMinutes: 1
    });
    if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

    const bodyLimit = enforceBodyLimit(req, 4 * 1024);
    if (bodyLimit) return bodyLimit;

    const body = (await req.json().catch(() => null)) as { studentId?: unknown } | null;
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    if (!studentId || studentId.length > 128) {
      return json({ ok: false, error: "studentId is required" }, { status: 400 });
    }

    const db = adminDb();
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) return json({ ok: false, error: "Student not found" }, { status: 404 });
    const student = studentSnap.data() as Record<string, unknown>;

    // Only the fields StudentDetailsReveal renders are ever stored on the token.
    const details = {
      name: String(student.studentName || ""),
      fatherName: String(student.fatherName || ""),
      motherName: String(student.motherName || ""),
      phone: String(student.phone || ""),
      address: String(student.address || "")
    };

    const token = issueToken();
    const now = Date.now();
    await db.collection("student_qr_tokens").doc(token).set({
      studentId,
      schoolId: getSchoolId(auth),
      details,
      createdBy: auth.uid,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + QR_TOKEN_TTL_MS),
      usedAt: null
    });

    return json({ ok: true, token, expiresInMs: QR_TOKEN_TTL_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to issue QR code";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
