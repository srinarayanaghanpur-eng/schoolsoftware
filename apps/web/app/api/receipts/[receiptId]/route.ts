import { NextResponse } from "next/server";
import type { Role } from "@sri-narayana/shared";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { getLinkedStudentIds } from "@/lib/portalHelpers";
import { createReceiptFromPayment, getReceiptById, markReceiptPrinted } from "@/lib/receiptService";
import { roleHasPermission } from "@/lib/rbacAdmin";

async function canPrintReceipt(role: Role | undefined) {
  return roleHasPermission(role, "fees.create");
}

export async function GET(req: Request, { params }: { params: { receiptId: string } }) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const role = await resolveRole(token);
  let receipt = await getReceiptById(params.receiptId);
  const canPrint = await canPrintReceipt(role);
  if (!receipt && canPrint) {
    receipt = await createReceiptFromPayment(params.receiptId, token).catch(() => null);
  }
  if (!receipt) return NextResponse.json({ ok: false, error: "Receipt not found" }, { status: 404 });

  if (await roleHasPermission(role, "fees.view")) {
    return NextResponse.json({ ok: true, receipt, canPrint });
  }

  if (await roleHasPermission(role, "portal.view")) {
    const linkedStudentIds = await getLinkedStudentIds(token);
    if (linkedStudentIds.includes(receipt.studentId)) {
      return NextResponse.json({ ok: true, receipt, canPrint: false });
    }
  }

  return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
}

export async function PATCH(req: Request, { params }: { params: { receiptId: string } }) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(token);
  if (!await canPrintReceipt(role)) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.action !== "markPrinted") {
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  }

  const receipt = await markReceiptPrinted(params.receiptId, token);
  return NextResponse.json({ ok: true, receipt });
}
