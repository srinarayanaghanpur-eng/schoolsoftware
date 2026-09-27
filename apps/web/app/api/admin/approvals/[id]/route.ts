import { approvalRequestReviewSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, requireSuperAdmin, json } from "@/lib/apiUtils";
import { reviewApprovalRequest } from "@/lib/approvalEngine";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = approvalRequestReviewSchema.parse(body);

    // Class promotion / demotion is strictly super-admin: any other admin
    // attempting to decide one gets a 403 before any effect can run.
    const targetSnap = await adminDb().collection("approval_requests").doc(params.id).get();
    const targetType = targetSnap.exists ? String((targetSnap.data() as Record<string, unknown>)?.requestType ?? "") : "";
    const reviewer = targetType === "promotion" ? await requireSuperAdmin(req) : decodedToken;
    if (!reviewer) {
      return json(
        { ok: false, error: targetType === "promotion" ? "Only a super admin can approve promotions." : "Admin access required" },
        { status: 403 }
      );
    }

    await reviewApprovalRequest({
      approvalId: params.id,
      status: parsed.status,
      notes: parsed.notes,
      reviewedBy: reviewer.uid,
      reviewedByName: reviewer.name ?? reviewer.uid
    });

    return json({ ok: true, message: `Approval request ${parsed.status}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review approval request";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

