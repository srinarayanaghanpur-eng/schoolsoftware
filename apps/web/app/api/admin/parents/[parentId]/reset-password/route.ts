import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { passwordResetSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requirePermission } from "@/lib/apiUtils";

export async function POST(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = passwordResetSchema.parse(body);

    const userRef = adminDb().collection("users").doc(params.parentId);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, error: "Parent not found" }, { status: 404 });
    }

    const userData = snapshot.data();
    if (userData?.role !== "parent") {
      return NextResponse.json({ ok: false, error: "User is not a parent" }, { status: 400 });
    }

    await adminAuth().updateUser(params.parentId, { password: parsed.password });
    await userRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await adminDb().collection("password_reset_history").add({
      parentId: params.parentId,
      parentName: String(userData?.displayName ?? ""),
      resetBy: decodedToken.uid,
      resetAt: new Date().toISOString(),
      note: body.adminNote ?? ""
    });

    return NextResponse.json({ ok: true, message: "Parent password reset successfully." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, "Unable to reset password") }, { status: 400 });
  }
}
