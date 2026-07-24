import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const children = await getPortalLinkedStudents(token);
  return NextResponse.json({ ok: true, children });
}
