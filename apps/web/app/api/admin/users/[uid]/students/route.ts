import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { userStudentsLinkSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// PATCH /api/admin/users/[uid]/students — link a parent/student user to student record(s).
// The portal reads these ids to scope what the user can see.
export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  const token = await requirePermission(req, "users.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { studentIds } = userStudentsLinkSchema.parse(await req.json());
    await adminDb()
      .collection("users")
      .doc(params.uid)
      .set({ uid: params.uid, studentIds, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, uid: params.uid, studentIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link students";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
