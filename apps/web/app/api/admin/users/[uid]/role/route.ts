import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { isValidRole } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/apiUtils";

// PATCH /api/admin/users/[uid]/role — assign a role (admin only).
// Sets the Firebase custom claim AND the users/{uid} doc so login resolves it.
export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  const token = await requireRole(req, ["settings_manager"]);
  if (!token) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

  try {
    const body = await req.json();
    const role = body?.role;
    if (!isValidRole(role)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
    }

    const auth = adminAuth();
    const user = await auth.getUser(params.uid); // 404s if the uid doesn't exist
    const existingClaims = user.customClaims ?? {};
    await auth.setCustomUserClaims(params.uid, { ...existingClaims, role });

    await adminDb()
      .collection("users")
      .doc(params.uid)
      .set({ uid: params.uid, role, status: "active", updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return NextResponse.json({ ok: true, uid: params.uid, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign role";
    const status = message.includes("no user record") ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
