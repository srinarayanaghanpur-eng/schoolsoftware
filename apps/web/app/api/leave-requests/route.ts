import { NextResponse } from "next/server";
import { leaveRequestCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireSignedIn, serializeDoc } from "@/lib/apiUtils";

async function getTeacherForToken(uid: string, teacherId?: unknown) {
  const db = adminDb();
  const resolvedTeacherId = typeof teacherId === "string" ? teacherId : "";
  if (resolvedTeacherId) {
    const teacherDoc = await db.collection("teachers").doc(resolvedTeacherId).get();
    if (teacherDoc.exists) return { id: teacherDoc.id, data: teacherDoc.data() ?? {} };
  }

  const snapshot = await db.collection("teachers").where("uid", "==", uid).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? { id: doc.id, data: doc.data() } : null;
}

export async function GET(req: Request) {
  try {
    const decodedToken = await requireSignedIn(req);
    if (!decodedToken || decodedToken.role !== "teacher") {
      return NextResponse.json({ ok: false, error: "Teacher access required" }, { status: 403 });
    }

    const teacher = await getTeacherForToken(decodedToken.uid, decodedToken.teacherId);
    if (!teacher) {
      return NextResponse.json({ ok: false, error: "Teacher profile not found" }, { status: 404 });
    }

    const snapshot = await adminDb()
      .collection("leave_requests")
      .where("teacherId", "==", teacher.id)
      .limit(50)
      .get();

    const requests = snapshot.docs
      .map((doc) => serializeDoc(doc))
      .sort((a, b) => String(b.requestedAt ?? "").localeCompare(String(a.requestedAt ?? "")));
    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load leave requests";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireSignedIn(req);
    if (!decodedToken || decodedToken.role !== "teacher") {
      return NextResponse.json({ ok: false, error: "Teacher access required" }, { status: 403 });
    }

    const teacher = await getTeacherForToken(decodedToken.uid, decodedToken.teacherId);
    if (!teacher) {
      return NextResponse.json({ ok: false, error: "Teacher profile not found" }, { status: 404 });
    }

    const parsed = leaveRequestCreateSchema.parse(await req.json());
    const requestedAt = new Date().toISOString();
    const teacherData = teacher.data;
    const requestRef = adminDb().collection("leave_requests").doc();

    await adminDb().runTransaction(async (transaction) => {
      transaction.set(requestRef, {
        teacherId: teacher.id,
        teacherName: String(teacherData.fullName ?? ""),
        employeeId: String(teacherData.employeeId ?? ""),
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        reason: parsed.reason,
        status: "pending",
        requestedAt,
        attendanceUpdated: false
      });
      transaction.set(adminDb().collection("admin_notifications").doc(), {
        type: "leave_request",
        title: "Leave request",
        message: `${String(teacherData.fullName ?? teacher.id)} requested leave from ${parsed.startDate} to ${parsed.endDate}.`,
        relatedCollection: "leave_requests",
        relatedId: requestRef.id,
        status: "open",
        createdAt: requestedAt
      });
    });

    return NextResponse.json({ ok: true, requestId: requestRef.id, message: "Leave request sent to admin." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit leave request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
