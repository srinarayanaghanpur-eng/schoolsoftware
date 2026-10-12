import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { getStudentsForParent } from "@/lib/parentStudentLink";
import { hasPermission, type Role } from "@sri-narayana/shared";
import type { DecodedIdToken } from "firebase-admin/auth";

export type PortalAccess =
  | { ok: true; token: DecodedIdToken; role: Role }
  | { ok: false; status: 401 | 403 };

/**
 * Shared preamble for every /api/portal/* route: bearer auth, DB-resolved
 * role (so demotions apply within ~60s), and the portal.view permission.
 * Returns a status the route turns into its standard error envelope.
 */
export async function authorizePortalRequest(req: Request): Promise<PortalAccess> {
  const token = await verifyBearerToken(req);
  if (!token) return { ok: false, status: 401 };
  const role = await resolveRole(token);
  if (!role || !hasPermission(role, "portal.view")) return { ok: false, status: 403 };
  return { ok: true, token, role };
}

/**
 * Shared student picker: a requested id wins only when it belongs to the
 * caller's linked set and is a plausible document id (no slashes, bounded
 * length — it flows into a Firestore doc path). Otherwise the first linked
 * student is used, preserving the long-standing default.
 */
export function resolveLinkedStudentId(
  linked: Array<{ id: string }>,
  requested: string | null
): string | null {
  if (linked.length === 0) return null;
  if (
    requested &&
    requested.length > 0 &&
    requested.length <= 100 &&
    !requested.includes("/") &&
    linked.some((s) => s.id === requested)
  ) {
    return requested;
  }
  return linked[0].id;
}

export async function getLinkedStudentIds(token: DecodedIdToken): Promise<string[]> {
  const links = await getStudentsForParent(token.uid);
  return links.map((l) => l.studentId);
}

export async function verifyStudentLinked(token: DecodedIdToken, studentId: string): Promise<boolean> {
  const links = await getStudentsForParent(token.uid);
  return links.some((l) => l.studentId === studentId);
}

export async function verifyAndGetStudent(token: DecodedIdToken, studentId: string) {
  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return null;
  const snap = await adminDb().collection("students").doc(studentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

export async function getPortalLinkedStudents(token: DecodedIdToken) {
  const links = await getStudentsForParent(token.uid);
  const ids = links.map((l) => l.studentId);
  if (ids.length === 0) return [];
  // Safety limit — cap at 50 to prevent unbounded N+1 Firestore reads.
  const MAX_STUDENTS = 50;
  const limitedIds = ids.slice(0, MAX_STUDENTS);
  const snaps = await Promise.all(limitedIds.map((id) => adminDb().collection("students").doc(id).get()));
  return snaps
    .filter((s) => s.exists)
    .map((s) => {
      const d = s.data() as Record<string, unknown>;
      return { id: s.id, name: String(d.studentName || ""), className: String(d.class || ""), section: String(d.section || "") };
    });
}
