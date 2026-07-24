import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getStudentsForParent } from "@/lib/parentStudentLink";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(token.uid).get();
  const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
  const links = await getStudentsForParent(token.uid);

  const linkedStudents = await Promise.all(
    links.map(async (link) => {
      const snap = await db.collection("students").doc(link.studentId).get();
      if (!snap.exists) return null;
      const s = snap.data() as Record<string, unknown>;
      return {
        id: link.studentId,
        name: s.studentName || "",
        className: s.class || "",
        section: s.section || "",
        admissionNo: s.admissionNumber || "",
        relationship: link.relationship,
        isPrimary: link.isPrimary,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    profile: {
      name: userData.displayName || token.name || "",
      email: token.email || "",
      phone: userData.phone || "",
      address: userData.address || "",
      notificationPreferences: userData.notificationPreferences || { app: true, email: true, sms: false },
    },
    linkedStudents: linkedStudents.filter(Boolean),
  });
}

export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const body = await req.json().catch(() => ({}));
  const { field, value } = body;

  if (!field || !value) {
    return NextResponse.json({ ok: false, error: "Field and value are required" }, { status: 400 });
  }

  const docRef = await db.collection("approval_requests").add({
    requestType: "profile_update",
    entityType: "parent_profile",
    entityId: token.uid,
    title: `Parent profile update: ${field}`,
    description: `${field} change requested to: ${value}`,
    requestedBy: token.uid,
    requestedByName: token.name || "",
    requestedAt: new Date().toISOString(),
    status: "pending",
    payload: { field, newValue: value, currentValue: null },
  });

  return NextResponse.json({ ok: true, id: docRef.id, message: "Update request submitted for admin approval." });
}
