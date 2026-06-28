import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiUtils";
import { getBranches, createBranch } from "@/lib/branchContext";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const branches = await getBranches();
    return NextResponse.json({ ok: true, branches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load branches";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, address, phone, email, isActive } = body;

    if (!name || !code) {
      return NextResponse.json({ ok: false, error: "Name and code are required" }, { status: 400 });
    }

    const id = await createBranch({
      name,
      code,
      address: address ?? "",
      phone: phone ?? "",
      email: email ?? "",
      isActive: isActive ?? true
    });

    await writeAuditLog({
      action: "branch.created",
      entityType: "branch",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: { name, code }
    });

    return NextResponse.json({ ok: true, id, message: "Branch created." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create branch";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
