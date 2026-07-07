import { NextResponse } from "next/server";
import { ROLE_LABELS, SELF_LOCK_PERMISSIONS, SUPER_ADMIN_CRITICAL_PERMISSIONS, type Permission } from "@sri-narayana/shared";
import { requireAllPermissions, resolveRole } from "@/lib/apiUtils";
import {
  ensureRoleDocuments,
  isKnownPermission,
  isSelfLockPermission,
  isSuperAdminCriticalPermission,
  parseRole,
  updateRolePermission
} from "@/lib/rbacAdmin";
import { verifyBearerToken } from "@/lib/firebaseAdmin";

const VIEW_PERMISSIONS: Permission[] = ["users.view", "roles.view", "permissions.view"];
const EDIT_PERMISSIONS: Permission[] = ["roles.edit", "permissions.edit"];

// GET /api/admin/roles — editable RBAC role documents for the Users & Roles matrix.
export async function GET(req: Request) {
  const token = await requireAllPermissions(req, VIEW_PERMISSIONS);
  if (!token) return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });

  const roles = await ensureRoleDocuments(token.uid);
  return NextResponse.json({ ok: true, roles });
}

// PATCH /api/admin/roles — toggle one permission on one role.
export async function PATCH(req: Request) {
  const decoded = await verifyBearerToken(req);
  if (!decoded) return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
  const actorRole = await resolveRole(decoded);
  const canEdit = actorRole === "super_admin" || Boolean(await requireAllPermissions(req, EDIT_PERMISSIONS));
  if (!canEdit) return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });

  try {
    const body = await req.json();
    const role = parseRole(body?.role);
    const permission = String(body?.permission ?? "").trim();
    const allowed = Boolean(body?.allowed);

    if (!role) return NextResponse.json({ ok: false, error: "Invalid role." }, { status: 400 });
    if (!isKnownPermission(permission)) return NextResponse.json({ ok: false, error: "Invalid permission." }, { status: 400 });

    if (role === "super_admin" && !allowed && isSuperAdminCriticalPermission(permission)) {
      return NextResponse.json({ ok: false, error: "Super Admin permissions cannot be removed." }, { status: 400 });
    }

    if (actorRole === role && !allowed && isSelfLockPermission(permission)) {
      return NextResponse.json({ ok: false, error: "You cannot remove your own permission to manage roles." }, { status: 400 });
    }

    const result = await updateRolePermission({
      role,
      permission,
      allowed,
      changedBy: decoded.uid,
      changedByName: String(decoded.name || decoded.email || decoded.uid)
    });

    return NextResponse.json({
      ok: true,
      role: {
        slug: result.role,
        label: ROLE_LABELS[result.role],
        permissions: result.permissions
      },
      permission: result.permission,
      allowed: result.allowed,
      action: result.action,
      protectedPermissions: {
        superAdmin: SUPER_ADMIN_CRITICAL_PERMISSIONS,
        selfLock: SELF_LOCK_PERMISSIONS
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update permission." }, { status: 400 });
  }
}
