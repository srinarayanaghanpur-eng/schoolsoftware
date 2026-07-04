import { NextResponse } from "next/server";
import { leaveRequestReviewSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc } from "@/lib/apiUtils";
import { reviewLeaveRequest } from "@/lib/leaveReview";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const snapshot = await adminDb().collection("leave_requests").orderBy("requestedAt", "desc").limit(100).get();
    return NextResponse.json({ ok: true, requests: snapshot.docs.map((doc) => serializeDoc(doc)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load leave requests";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const requestId = String(body.requestId ?? "").trim();
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "Request ID is required" }, { status: 400 });
    }

    const parsed = leaveRequestReviewSchema.parse(body);
    const result = await reviewLeaveRequest(adminDb(), requestId, parsed.status, parsed.adminNote ?? "", decodedToken.uid);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: `Leave request ${parsed.status}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update leave request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
