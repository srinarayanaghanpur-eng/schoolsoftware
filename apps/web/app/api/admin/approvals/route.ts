import { approvalRequestCreateSchema } from "@sri-narayana/shared";
import { requireAdmin, json } from "@/lib/apiUtils";
import { createApprovalRequest, getApprovalRequestCount, getApprovalRequests } from "@/lib/approvalEngine";
import { firestoreErrorResponse, firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const requestType = url.searchParams.get("requestType") ?? undefined;
    const countOnly = url.searchParams.get("count") === "1";

    if (isFirestoreQuotaPaused()) {
      return firestoreQuotaResponse();
    }

    if (countOnly) {
      const count = await getApprovalRequestCount({
        status: status as "pending" | "approved" | "rejected" | undefined,
        requestType: requestType ?? undefined
      });
      return json({ ok: true, count });
    }

    const requests = await getApprovalRequests({
      status: status as "pending" | "approved" | "rejected" | undefined,
      requestType: requestType ?? undefined
    });

    return json({ ok: true, requests });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to load approvals", 400);
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = approvalRequestCreateSchema.parse(body);

    const id = await createApprovalRequest({
      ...parsed,
      requestedBy: decodedToken.uid,
      requestedByName: decodedToken.name ?? decodedToken.uid
    });

    return json({ ok: true, id, message: "Approval request created." });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to create approval request", 400);
  }
}

