import { NextResponse } from "next/server";
import { approvalRequestCreateSchema } from "@sri-narayana/shared";
import { requireAdmin } from "@/lib/apiUtils";
import { createApprovalRequest, getApprovalRequests } from "@/lib/approvalEngine";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const requestType = url.searchParams.get("requestType") ?? undefined;

    const requests = await getApprovalRequests({
      status: status as "pending" | "approved" | "rejected" | undefined,
      requestType: requestType ?? undefined
    });

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load approvals";
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
    const parsed = approvalRequestCreateSchema.parse(body);

    const id = await createApprovalRequest({
      ...parsed,
      requestedBy: decodedToken.uid,
      requestedByName: decodedToken.name ?? decodedToken.uid
    });

    return NextResponse.json({ ok: true, id, message: "Approval request created." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create approval request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
