import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { parentMessageCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { verifyStudentLinked } from "@/lib/portalHelpers";

const COLLECTION = "parent_messages";

export async function POST(req: Request) {
  try {
    const decodedToken = await verifyBearerToken(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
    }

    const role = await resolveRole(decodedToken);
    if (role !== "parent") {
      return NextResponse.json({ ok: false, error: "Only parents can submit messages." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentMessageCreateSchema.parse(body);

    if (parsed.parentUid !== decodedToken.uid) {
      return NextResponse.json({ ok: false, error: "parentUid must match your account." }, { status: 403 });
    }

    const db = adminDb();
    const parentSnap = await db.collection("users").doc(decodedToken.uid).get();
    const parentData = parentSnap.data() ?? {};

    let studentName = "";
    if (parsed.studentId) {
      // IDOR guard: a parent may only message about a student they are
      // actually linked to — otherwise arbitrary student IDs could be probed
      // for names/records by attaching them to a message.
      const linked = await verifyStudentLinked(decodedToken, parsed.studentId);
      if (!linked) {
        return NextResponse.json(
          { ok: false, error: "You can only send messages about your own child." },
          { status: 403 }
        );
      }
      const studentSnap = await db.collection("students").doc(parsed.studentId).get();
      if (studentSnap.exists) {
        studentName = (studentSnap.data() as Record<string, unknown>)?.studentName as string ?? "";
      }
    }

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      parentUid: parsed.parentUid,
      parentName: (parentData.displayName as string) ?? "",
      studentId: parsed.studentId,
      studentName,
      type: parsed.type,
      subject: parsed.subject,
      body: parsed.body,
      status: "open",
      reply: "",
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({ ok: true, id: ref.id, message: "Message sent successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send message";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
