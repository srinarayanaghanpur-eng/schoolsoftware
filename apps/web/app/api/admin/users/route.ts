import { isValidRole, type Permission } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAllPermissions, serializeDoc, json } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const VIEW_PERMISSIONS: Permission[] = ["users.view", "roles.view", "permissions.view"];

// GET /api/admin/users — server-side user list for Users & Roles.
export async function GET(req: Request) {
  const token = await requireAllPermissions(req, VIEW_PERMISSIONS);
  if (!token) return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 250, 1000);
  const db = adminDb();
  const snap = await db.collection("users").limit(pageSize).get();
  logFirestoreRead("UsersAPI", "users", snap, { pageSize });

  const users = snap.docs
    .map((doc) => {
      const data = serializeDoc<Record<string, unknown>>(doc);
      const role = isValidRole(data.role) ? data.role : undefined;
      const studentIds = Array.isArray(data.studentIds)
        ? data.studentIds.filter((item): item is string => typeof item === "string")
        : [];
      return {
        uid: doc.id,
        displayName: String(data.displayName || data.email || data.employeeId || doc.id),
        email: typeof data.email === "string" ? data.email : undefined,
        employeeId: typeof data.employeeId === "string" ? data.employeeId : undefined,
        internalEmail: typeof data.internalEmail === "string" ? data.internalEmail : undefined,
        status: typeof data.status === "string" ? data.status : "active",
        role,
        studentIds
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return json({ ok: true, users, pageSize, truncated: snap.size >= pageSize });
}

