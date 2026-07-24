import { FieldValue } from "firebase-admin/firestore";
import { teacherLoginUpdateSchema, type LateDeductionMode, type EmploymentType } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, json } from "@/lib/apiUtils";
import { assertEmployeeIdAvailable, buildTeacherAuthProfile, serializeTeacherDoc } from "@/lib/teacherAdmin";

function isLateDeductionMode(value: unknown): value is LateDeductionMode {
  return value === "none" || value === "half_day" || value === "fixed" || value === "after_3_lates_one_day";
}

function safeString(val: unknown): string | undefined {
  if (typeof val === "string" && val.trim()) return val.trim();
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as any).toDate === "function") {
    return (val as any).toDate().toISOString().slice(0, 10);
  }
  return undefined;
}

function safeNumber(val: unknown): number | undefined {
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export async function PATCH(req: Request, { params }: { params: { teacherId: string } }) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const raw = body.teacher ?? body;
    const parsed = teacherLoginUpdateSchema.parse(raw);

    const db = adminDb();
    const docRef = db.collection("teachers").doc(params.teacherId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return json({ ok: false, error: "Teacher not found" }, { status: 404 });
    }

    const existing = snapshot.data() ?? {};

    // Preserve existing field values when the client did not send them.
    // Zod defaults would otherwise reset employmentType, joiningDate, etc.
    const keysSent = new Set(Object.keys(raw));
    const preserved: Record<string, unknown> = {};

    if (!keysSent.has("joiningDate")) {
      preserved.joiningDate = (existing.joiningDate != null && String(existing.joiningDate).trim() !== "")
        ? String(existing.joiningDate).trim()
        : new Date().toISOString().slice(0, 10);
    }
    if (!keysSent.has("employmentType")) {
      preserved.employmentType = (["full_time", "part_time_morning", "part_time_afternoon"].includes(String(existing.employmentType))
        ? String(existing.employmentType)
        : undefined) as EmploymentType | undefined;
    }
    if (!keysSent.has("allowedCLPerMonth") && typeof existing.allowedCLPerMonth === "number") {
      preserved.allowedCLPerMonth = existing.allowedCLPerMonth;
    }
    if (!keysSent.has("lateDeductionRule") && isLateDeductionMode(existing.lateDeductionRule)) {
      preserved.lateDeductionRule = existing.lateDeductionRule;
    }
    if (!keysSent.has("phone") && existing.phone) {
      preserved.phone = String(existing.phone);
    }
    if (!keysSent.has("biometricUserId") && existing.biometricUserId) {
      preserved.biometricUserId = String(existing.biometricUserId);
    }

    const teacherProfile = buildTeacherAuthProfile({
      ...parsed,
      ...preserved
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
    const updatedTeacherData: Record<string, unknown> = {
      fullName: teacherProfile.fullName,
      employeeId: teacherProfile.employeeId,
      employeeIdLower: teacherProfile.employeeIdLower,
      internalEmail: teacherProfile.internalEmail,
      subject: teacherProfile.subject,
      phone: teacherProfile.phone,
      baseSalary: teacherProfile.baseSalary,
      biometricUserId: teacherProfile.biometricUserId,
      joiningDate: teacherProfile.joiningDate,
      status: teacherProfile.status,
      role: teacherProfile.role,
      employmentType: teacherProfile.employmentType,
      allowedCLPerMonth: teacherProfile.allowedCLPerMonth,
      lateDeductionRule: teacherProfile.lateDeductionRule,
      uid,
      updatedAt: timestamp
    };

    // Preserve fields that should never be overwritten
    for (const key of ["branchId", "schoolId", "createdAt"]) {
      if (existing[key] !== undefined) {
        updatedTeacherData[key] = existing[key];
      }
    }

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
          employmentType: teacherProfile.employmentType,
          updatedAt: timestamp
        },
        { merge: true }
      )
    ]);

    // Construct response from written data instead of reading again
    return json({
      ok: true,
      message: "Teacher details updated successfully.",
      teacher: serializeTeacherDoc({ id: params.teacherId, exists: () => true, data: () => updatedTeacherData } as any)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update teacher";
    if (process.env.NODE_ENV === "development") {
      console.error("[TeacherEdit] Error:", error);
    }
    return json({ ok: false, error: message }, { status: 400 });
  }
}

