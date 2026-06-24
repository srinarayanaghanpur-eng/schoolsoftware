import { NextResponse } from "next/server";
import { passwordResetRequestUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, serializeDoc } from "@/lib/apiUtils";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const snapshot = await adminDb()
      .collection("password_reset_requests")
      .orderBy("requestedAt", "desc")
      .limit(100)
      .get();

    return NextResponse.json({
      ok: true,
      requests: snapshot.docs.map((doc) => serializeDoc(doc))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load password requests";
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

    const parsed = passwordResetRequestUpdateSchema.parse(body);
    const updatedAt = new Date().toISOString();
    await adminDb().collection("password_reset_requests").doc(requestId).set(
      {
        status: parsed.status,
        adminNote: parsed.adminNote,
        resolvedAt: parsed.status === "open" ? "" : updatedAt,
        resolvedBy: parsed.status === "open" ? "" : decodedToken.uid
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, message: "Password request updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update password request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
