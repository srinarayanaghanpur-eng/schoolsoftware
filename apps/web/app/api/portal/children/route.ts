import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { getPortalLinkedStudents } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(token);
  if (!hasPermission(role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const children = await getPortalLinkedStudents(token);
  return NextResponse.json({ ok: true, children });
}
