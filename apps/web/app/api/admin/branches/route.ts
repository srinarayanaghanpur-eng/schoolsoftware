import { requireAdmin, json } from "@/lib/apiUtils";
import { getBranchById, getBranches, createBranch, updateBranch } from "@/lib/branchContext";
import { writeAuditLog } from "@/lib/auditLog";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const branches = await getBranches();
    return json({ ok: true, branches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load branches";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, address, phone, email, isActive } = body;

    const cleanName = cleanString(name);
    const cleanCode = cleanString(code);

    if (!cleanName || !cleanCode) {
      return json({ ok: false, error: "Name and code are required" }, { status: 400 });
    }

    const existing = await getBranches();
    if (existing.some((branch) => branch.code.toLowerCase() === cleanCode.toLowerCase())) {
      return json({ ok: false, error: "A branch with this code already exists" }, { status: 409 });
    }

    const id = await createBranch({
      name: cleanName,
      code: cleanCode,
      address: cleanString(address),
      phone: cleanString(phone),
      email: cleanString(email),
      isActive: isActive ?? true
    });

    await writeAuditLog({
      action: "branch.created",
      entityType: "branch",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: { name: cleanName, code: cleanCode }
    });

    return json({ ok: true, id, message: "Branch created." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create branch";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const id = cleanString(body.id);
    if (!id) {
      return json({ ok: false, error: "Branch id is required" }, { status: 400 });
    }

    const current = await getBranchById(id);
    if (!current) {
      return json({ ok: false, error: "Branch not found" }, { status: 404 });
    }

    const nextName = body.name === undefined ? current.name : cleanString(body.name);
    const nextCode = body.code === undefined ? current.code : cleanString(body.code);
    if (!nextName || !nextCode) {
      return json({ ok: false, error: "Name and code are required" }, { status: 400 });
    }

    const existing = await getBranches();
    if (existing.some((branch) => branch.id !== id && branch.code.toLowerCase() === nextCode.toLowerCase())) {
      return json({ ok: false, error: "A branch with this code already exists" }, { status: 409 });
    }

    const updates = {
      name: nextName,
      code: nextCode,
      address: body.address === undefined ? current.address ?? "" : cleanString(body.address),
      phone: body.phone === undefined ? current.phone ?? "" : cleanString(body.phone),
      email: body.email === undefined ? current.email ?? "" : cleanString(body.email),
      isActive: body.isActive === undefined ? current.isActive : Boolean(body.isActive)
    };

    await updateBranch(id, updates);
    await writeAuditLog({
      action: "branch.updated",
      entityType: "branch",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      oldValues: current,
      newValues: updates
    });

    return json({ ok: true, message: "Branch updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update branch";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

