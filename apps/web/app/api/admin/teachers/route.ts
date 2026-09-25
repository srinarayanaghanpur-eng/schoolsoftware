import { FieldValue } from "firebase-admin/firestore";
import { teacherLoginCreateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, json } from "@/lib/apiUtils";
import { firestoreErrorResponse, firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
import {
  assertEmployeeIdAvailable,
  buildTeacherAuthProfile,
  makeTeacherDocumentId,
  serializeTeacherDoc
} from "@/lib/teacherAdmin";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    if (isFirestoreQuotaPaused()) {
      return firestoreQuotaResponse();
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const rawPageSize = Number(searchParams.get("pageSize") ?? "50");
    const limit = Math.min(Math.max(Number.isFinite(rawPageSize) ? rawPageSize : 50, 1), 100);
    const cursor = searchParams.get("cursor")?.trim() ?? "";

    const db = adminDb();
    let baseQuery = db
      .collection("teachers")
      .orderBy("fullName");

    if (query) {
      // Prefix range on the ordered field keeps the read bounded server-side.
      baseQuery = baseQuery.startAt(query).endAt(query + "\uf8ff");
    }
    if (cursor) {
      const cursorSnap = await db.collection("teachers").doc(cursor).get();
      if (cursorSnap.exists) baseQuery = baseQuery.startAfter(cursorSnap);
    }
    const snapshot = await baseQuery.limit(limit + 1).get();

    const teachers = snapshot.docs
      .slice(0, limit)
      .map(serializeTeacherDoc)
      .filter((teacher) => {
        if (!query) return true;
        // Range scan matches name prefixes; also accept employee/subject hits.
        return `${teacher.fullName} ${teacher.employeeId} ${teacher.subject}`.toLowerCase().includes(query);
      });

    const hasMore = snapshot.docs.length > limit;
    const nextCursor = hasMore ? snapshot.docs[limit - 1]?.id ?? null : null;

    return json({ ok: true, teachers, count: teachers.length, limit, hasMore, nextCursor });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to load teachers", 400);
  }
}

export async function POST(req: Request) {
  let createdUid: string | undefined;

  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = teacherLoginCreateSchema.parse(body.teacher ?? body);
    const teacherProfile = buildTeacherAuthProfile(parsed);
    await assertEmployeeIdAvailable(teacherProfile.employeeIdLower);

    const db = adminDb();
    const teacherId = makeTeacherDocumentId(teacherProfile.employeeId);
    const docRef = db.collection("teachers").doc(teacherId);
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      throw new Error("Employee ID already exists");
    }

    const authUser = await adminAuth().createUser({
      email: teacherProfile.internalEmail,
      password: parsed.password,
      displayName: teacherProfile.fullName
    });
    createdUid = authUser.uid;

    await adminAuth().setCustomUserClaims(authUser.uid, {
      role: "teacher",
      teacherId: docRef.id,
      employeeId: teacherProfile.employeeId,
      status: teacherProfile.status
    });

    const timestamp = FieldValue.serverTimestamp();
    await docRef.set({
      ...teacherProfile,
      id: docRef.id,
      uid: authUser.uid,
      profilePhotoUrl: "",
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      role: "teacher",
      teacherId: docRef.id,
      employeeId: teacherProfile.employeeId,
      internalEmail: teacherProfile.internalEmail,
      displayName: teacherProfile.fullName,
      status: teacherProfile.status,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return json({
      ok: true,
      message: "Teacher login and Firestore profile created successfully.",
      teacherId: docRef.id,
      uid: authUser.uid
    });
  } catch (error) {
    if (createdUid) {
      await adminAuth().deleteUser(createdUid).catch(() => undefined);
    }
    return firestoreErrorResponse(error, "Unable to create teacher", 400);
  }
}
