import { NextResponse } from "next/server";
import { approvalRequestReviewSchema } from "@sri-narayana/shared";
import { requireAdmin } from "@/lib/apiUtils";
import { reviewApprovalRequest } from "@/lib/approvalEngine";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = approvalRequestReviewSchema.parse(body);

    await reviewApprovalRequest({
      approvalId: params.id,
      status: parsed.status,
      notes: parsed.notes,
      reviewedBy: decodedToken.uid,
      reviewedByName: decodedToken.name ?? decodedToken.uid
    });

    return NextResponse.json({ ok: true, message: `Approval request ${parsed.status}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review approval request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
