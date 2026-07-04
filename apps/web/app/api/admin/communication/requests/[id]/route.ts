import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, requireSuperAdmin } from "@/lib/apiUtils";
import { firestoreErrorResponse } from "@/lib/firebaseErrors";
import { reviewLeaveRequest } from "@/lib/leaveReview";
import { sourceForType } from "@/lib/communicationRequests";

type RouteContext = { params: { id: string } };

// PATCH /api/admin/communication/requests/:id
// Body: { type, action: "approve" | "reject" | "archive" | "restore", note? }
export async function PATCH(req: Request, { params }: RouteContext) {
  const token = await requireAdmin(req);
  if (!token) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

  const id = params.id;
  try {
    const body = await req.json();
    const source = sourceForType(String(body?.type ?? ""));
    if (!source) return NextResponse.json({ ok: false, error: "Unknown request type" }, { status: 400 });
    const action = String(body?.action ?? "");
    const note = String(body?.note ?? "");
    const db = adminDb();
    const ref = db.collection(source.collection).doc(id);
    const now = new Date().toISOString();

    if (action === "archive" || action === "restore") {
      const archived = action === "archive";
      await ref.set(
        {
          archived,
          archivedAt: archived ? now : null,
          archivedBy: archived ? token.uid : null,
          updatedAt: now,
          updatedBy: token.uid
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true, message: archived ? "Request archived." : "Request restored." });
    }

    if (action === "reject") {
      if (!source.allowReject) {
        return NextResponse.json({ ok: false, error: "This request type cannot be rejected." }, { status: 400 });
      }
      if (source.type === "leave") {
        const result = await reviewLeaveRequest(db, id, "rejected", note, token.uid);
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
      } else {
        await ref.set(
          { status: "rejected", adminNote: note, resolvedAt: now, resolvedBy: token.uid, updatedAt: now, updatedBy: token.uid },
          { merge: true }
        );
      }
      return NextResponse.json({ ok: true, message: "Request rejected." });
    }

    if (action === "approve") {
      if (!source.allowApprove) {
        return NextResponse.json(
          { ok: false, error: source.type === "password_reset" ? "Use Reset Password to resolve this request." : "This request type cannot be approved here." },
          { status: 400 }
        );
      }
      // Only leave supports direct approve (writes attendance via shared helper).
      const result = await reviewLeaveRequest(db, id, "approved", note, token.uid);
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
      return NextResponse.json({ ok: true, message: "Request approved." });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to update request", 400);
  }
}

// DELETE /api/admin/communication/requests/:id?type=...&hard=1
// Soft-delete by default (sets deletedAt; hidden from normal queries). Hard
// delete requires super_admin. Audit logs can never be hard-deleted.
export async function DELETE(req: Request, { params }: RouteContext) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

  const id = params.id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const hard = searchParams.get("hard") === "1";
  const source = sourceForType(type);
  if (!source) return NextResponse.json({ ok: false, error: "Unknown request type" }, { status: 400 });

  try {
    const db = adminDb();
    const ref = db.collection(source.collection).doc(id);
    const now = new Date().toISOString();

    if (hard) {
      if (source.auditProtected) {
        return NextResponse.json({ ok: false, error: "Audit logs cannot be permanently deleted." }, { status: 403 });
      }
      const superAdmin = await requireSuperAdmin(req);
      if (!superAdmin) {
        return NextResponse.json({ ok: false, error: "Only a super admin can permanently delete." }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true, message: "Request permanently deleted." });
    }

    // Leave requests may only be removed once decided (never a pending one).
    if (source.type === "leave") {
      const snap = await ref.get();
      const st = String((snap.data() as { status?: string } | undefined)?.status ?? "");
      if (st === "pending") {
        return NextResponse.json({ ok: false, error: "Approve or reject the leave request before deleting it." }, { status: 409 });
      }
    }

    await ref.set({ deletedAt: now, deletedBy: admin.uid, updatedAt: now, updatedBy: admin.uid }, { merge: true });
    return NextResponse.json({ ok: true, message: "Request removed." });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to delete request", 400);
  }
}
