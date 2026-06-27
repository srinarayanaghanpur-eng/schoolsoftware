import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { teacherLoginUpdateSchema, type LateDeductionMode } from "@sri-narayana/shared";
import { adminAuth, adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { assertEmployeeIdAvailable, buildTeacherAuthProfile, serializeTeacherDoc } from "@/lib/teacherAdmin";

async function requireAdmin(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken || (decodedToken.role !== "admin" && decodedToken.role !== "super_admin")) {
    return null;
  }
  return decodedToken;
}

function isLateDeductionMode(value: unknown): value is LateDeductionMode {
  return value === "none" || value === "half_day" || value === "fixed" || value === "after_3_lates_one_day";
}

export async function PATCH(req: Request, { params }: { params: { teacherId: string } }) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = teacherLoginUpdateSchema.parse(body.teacher ?? body);

    const db = adminDb();
    const docRef = db.collection("teachers").doc(params.teacherId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, error: "Teacher not found" }, { status: 404 });
    }

    const existing = snapshot.data() ?? {};
    const existingLateDeductionRule = isLateDeductionMode(existing.lateDeductionRule)
      ? existing.lateDeductionRule
      : undefined;
    const teacherProfile = buildTeacherAuthProfile({
      ...parsed,
      joiningDate: parsed.joiningDate || (typeof existing.joiningDate === "string" ? existing.joiningDate : undefined),
      allowedCLPerMonth:
        parsed.allowedCLPerMonth ?? (typeof existing.allowedCLPerMonth === "number" ? existing.allowedCLPerMonth : undefined),
      lateDeductionRule: parsed.lateDeductionRule ?? existingLateDeductionRule
    });
    await assertEmployeeIdAvailable(teacherProfile.employeeIdLower, params.teacherId);

    const uid = typeof existing.uid === "string" ? existing.uid : undefined;
    if (!uid) {
      throw new Error("Teacher Auth user is missing");
    }

    await adminAuth().updateUser(uid, {
      email: teacherProfile.internalEmail,
      displayName: teacherProfile.fullName
    });
    await adminAuth().setCustomUserClaims(uid, {
      role: "teacher",
      teacherId: params.teacherId,
      employeeId: teacherProfile.employeeId,
      status: teacherProfile.status
    });

    const timestamp = FieldValue.serverTimestamp();
    const updatedTeacherData = {
      ...teacherProfile,
      id: params.teacherId,
      uid,
      updatedAt: timestamp
    };

    // Parallelize writes and remove final read (~8s saved: no extra GET)
    await Promise.all([
      docRef.set(updatedTeacherData, { merge: true }),
      db.collection("users").doc(uid).set(
        {
          uid,
          role: "teacher",
          teacherId: params.teacherId,
          employeeId: teacherProfile.employeeId,
          internalEmail: teacherProfile.internalEmail,
          displayName: teacherProfile.fullName,
          status: teacherProfile.status,
          updatedAt: timestamp
        },
        { merge: true }
      )
    ]);

    // Construct response from written data instead of reading again
    return NextResponse.json({
      ok: true,
      message: "Teacher details updated successfully.",
      teacher: serializeTeacherDoc({ id: params.teacherId, exists: () => true, data: () => updatedTeacherData } as any)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update teacher";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
