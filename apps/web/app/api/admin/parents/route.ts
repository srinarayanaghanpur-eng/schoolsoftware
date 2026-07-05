import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { parentCreateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requireAdmin } from "@/lib/apiUtils";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const snapshot = await adminDb()
      .collection("users")
      .where("role", "==", "parent")
      .limit(100)
      .get();

    let parents = snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        ...doc.data(),
        id: doc.id
      }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(a.displayName ?? "").localeCompare(String(b.displayName ?? ""))
      );

    if (search) {
      parents = parents.filter((p: Record<string, unknown>) =>
        `${p.displayName} ${p.phone ?? ""} ${p.employeeId ?? ""}`
          .toLowerCase()
          .includes(search)
      );
    }

    return NextResponse.json({ ok: true, parents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load parents";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  let createdUid: string | undefined;

  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentCreateSchema.parse(body);
    const loginId = parsed.loginId.trim().toUpperCase();
    const internalEmail = employeeIdToInternalEmail(loginId);

    const db = adminDb();
    const existingUser = await db.collection("users").where("employeeId", "==", loginId).where("role", "==", "parent").get();
    if (!existingUser.empty) {
      throw new Error("Login ID already exists for a parent account");
    }

    const authUser = await adminAuth().createUser({
      email: internalEmail,
      password: parsed.password,
      displayName: parsed.fullName.trim()
    });
    createdUid = authUser.uid;

    await adminAuth().setCustomUserClaims(authUser.uid, {
      role: "parent"
    });

    const timestamp = FieldValue.serverTimestamp();
    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      role: "parent",
      employeeId: loginId,
      internalEmail,
      displayName: parsed.fullName.trim(),
      phone: parsed.phone.trim(),
      email: parsed.email?.trim() || "",
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await writeAuditLog({
      action: "parent.created",
      entityType: "user",
      entityId: authUser.uid,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: { displayName: parsed.fullName.trim(), phone: parsed.phone.trim(), loginId }
    });

    return NextResponse.json({
      ok: true,
      message: "Parent login created successfully.",
      uid: authUser.uid
    });
  } catch (error) {
    if (createdUid) {
      await adminAuth().deleteUser(createdUid).catch(() => undefined);
    }
    return NextResponse.json({ ok: false, error: errorMessage(error, "Unable to create parent") }, { status: 400 });
  }
}
