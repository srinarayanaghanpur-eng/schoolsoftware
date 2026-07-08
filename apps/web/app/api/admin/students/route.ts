import { NextRequest } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { createApprovalRequest } from "@/lib/approvalEngine";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { firestoreErrorResponse, firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
import { getSchoolId } from "@/lib/schoolScope";
import { markSummaryDirty } from "@/lib/markSummaryDirty";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function searchKeywords(name: string, admissionNumber: string, phone: string) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  return Array.from(new Set([admissionNumber.toLowerCase(), phone, ...words].filter(Boolean)));
}

/**
 * GET /api/admin/students
 * Get students with Firestore-level filtering and cursor pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "students.view");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    if (isFirestoreQuotaPaused()) {
      return firestoreQuotaResponse();
    }

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const classStr = searchParams.get('class');
    const section = searchParams.get('section');
    const branchId = searchParams.get("branchId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const academicYearId = searchParams.get("academicYearId") || "";
    const classId = searchParams.get("classId") || classStr || "";
    const sectionId = searchParams.get("sectionId") || section || "";
    const status = searchParams.get("status") || "";
    const q = searchParams.get("q")?.trim() || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    const applyScope = (baseQuery: any) => {
      let scoped = baseQuery;
      if (schoolId) scoped = scoped.where("schoolId", "==", schoolId);
      if (branchId) scoped = scoped.where("branchId", "==", branchId);
      if (academicYearId) scoped = scoped.where("academicYearId", "==", academicYearId);
      if (classId) scoped = scoped.where("class", "==", classId);
      if (sectionId) scoped = scoped.where("section", "==", sectionId);
      if (status) scoped = scoped.where("status", "==", status);
      return scoped;
    };

    // count=1 → return only an aggregate count for the current scope (1 read
    // per 1000 docs instead of reading every matching document).
    if (searchParams.get("count") === "1") {
      const countSnap = await applyScope(db.collection('students')).count().get();
      return json({ success: true, count: Number(countSnap.data().count || 0) });
    }

    let query: any = applyScope(db.collection('students'));
    let appliedLimit = pageSize;
    let canUseCursorPaging = false;

    if (q) {
      const normalized = normalizeText(q);
      if (/^\d{6,}$/.test(normalized)) {
        appliedLimit = 10;
        query = query.where("phone", "==", normalized);
      } else if (/^[a-z]*[-/]?\d+$/i.test(q) || /^\d+$/.test(q)) {
        appliedLimit = 10;
        query = query.where("admissionNumber", "==", q);
      } else {
        appliedLimit = Math.min(pageSize, 25);
        query = query.orderBy("studentNameLower", "asc").startAt(normalized).endAt(`${normalized}\uf8ff`);
      }
    } else {
      canUseCursorPaging = true;
      query = query.orderBy("admissionNumber", "asc");
    }

    if (cursor && canUseCursorPaging) {
      const cursorDoc = await db.collection("students").doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    query = query.limit(canUseCursorPaging ? pageSize + 1 : appliedLimit);

    let snapshot: FirebaseFirestore.QuerySnapshot;
    let sortedInMemory = false;
    try {
      snapshot = await query.get();
    } catch (queryError: any) {
      // FAILED_PRECONDITION (code 9) → composite index missing for this
      // filter+orderBy combination. Retry without orderBy and sort in memory
      // so the page keeps working while the index is created.
      if (queryError?.code === 9 || /FAILED_PRECONDITION|requires an index/i.test(String(queryError?.message))) {
        let fallback: any = applyScope(db.collection('students'));
        if (q) {
          const normalized = normalizeText(q);
          if (/^\d{6,}$/.test(normalized)) fallback = fallback.where("phone", "==", normalized);
          else if (/^[a-z]*[-/]?\d+$/i.test(q) || /^\d+$/.test(q)) fallback = fallback.where("admissionNumber", "==", q);
        }
        snapshot = await fallback.limit(500).get();
        sortedInMemory = true;
      } else {
        throw queryError;
      }
    }
    logFirestoreRead("StudentsAPI", "students", snapshot, { schoolId, branchId, academicYearId, classId, sectionId, status, q: q || "none", pageSize });
    let docs = snapshot.docs;
    if (sortedInMemory) {
      const key = q && !/^\d{6,}$/.test(normalizeText(q)) && !(/^[a-z]*[-/]?\d+$/i.test(q) || /^\d+$/.test(q))
        ? "studentNameLower" : "admissionNumber";
      docs = [...docs].sort((a, b) => String(a.data()[key] ?? "").localeCompare(String(b.data()[key] ?? "")));
      if (q && key === "studentNameLower") {
        const normalized = normalizeText(q);
        docs = docs.filter((d) => String(d.data().studentNameLower ?? "").startsWith(normalized));
      }
    }
    const pageDocs = canUseCursorPaging && !sortedInMemory ? docs.slice(0, pageSize) : docs.slice(0, sortedInMemory ? pageSize : docs.length);
    const students = pageDocs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));

    const nextCursor = canUseCursorPaging && !sortedInMemory && snapshot.docs.length > pageSize && pageDocs.length > 0
      ? pageDocs[pageDocs.length - 1].id
      : null;

    return json({ success: true, data: students, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    console.error('Error fetching students:', error);
    return firestoreErrorResponse(error, 'Failed to fetch students');
  }
}

/**
 * POST /api/admin/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "students.create");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const body = await request.json();
    const {
      studentName,
      class: classStr,
      section,
      gender,
      fatherName,
      motherName,
      dateOfBirth,
      email,
      phone,
      address,
      photoURL,
      aadhaarNumber,
      documentURLs,
      previousSchool,
      siblingAdmissionNumbers,
      emergencyContact,
      transportRouteId,
      transportStopName,
      transportFee
    } = body;

    // Validation — admission number is auto-generated, never client-supplied.
    if (!studentName || !classStr || !section) {
      return json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Optional external/reference id the school may keep (e.g. govt SATS id).
    const schoolId = String(body.schoolId ?? "").trim() || getSchoolId(auth);

    // Auto-generate a unique sequential admission number from a counter doc.
    // Prefix avoids collisions with legacy free-typed numbers ("2", "u98"...).
    const counterRef = db.collection("counters").doc("students");
    let admissionNumber = "";
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = Number(snap.data()?.nextAdmission ?? 1);
      admissionNumber = `SNHS${String(next).padStart(3, "0")}`;
      tx.set(counterRef, { nextAdmission: next + 1, updatedAt: new Date() }, { merge: true });
    });

    // Whether new admissions require admin approval. Controlled by the
    // settings/admissions doc (default true), overridable per-request.
    let requireApproval = true;
    try {
      const cfgSnap = await db.collection("settings").doc("admissions").get();
      const cfg = cfgSnap.exists ? cfgSnap.data() : undefined;
      if (cfg && typeof cfg.requireApproval === "boolean") requireApproval = cfg.requireApproval;
    } catch {
      // settings doc unavailable → keep default (require approval)
    }
    if (typeof body.requireApproval === "boolean") requireApproval = body.requireApproval;

    const originalFee = Number(body.annualEnrollmentFee || 0);
    const committedPayableFee = Number(body.commitmentFee || body.committedPayableFee || 0);
    const concessionAmount = Math.max(0, originalFee - committedPayableFee);
    const totalFeeAmount = committedPayableFee;
    const totalFeesPaid = 0;
    const totalFeesDue = totalFeeAmount;
    const feeStatus = totalFeeAmount > 0 ? 'pending' : 'paid';

    // Create student document
    const studentData: Record<string, unknown> = {
      admissionNumber,
      admissionNo: admissionNumber,
      schoolId,
      studentName,
      studentNameLower: normalizeText(studentName),
      class: classStr,
      classId: body.classId || classStr,
      section,
      sectionId: body.sectionId || section,
      branchId: body.branchId || "default-branch",
      academicYearId: body.academicYearId || "",
      status: body.status || "active",
      rollNo: Number(body.rollNo || String(admissionNumber).replace(/\D/g, "") || 0),
      gender: gender || '',
      fatherName: fatherName || '',
      fatherPhone: body.fatherPhone || '',
      motherName: motherName || '',
      motherPhone: body.motherPhone || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      email: email || '',
      phone: phone || '',
      address: address || '',
      photoURL: photoURL || '',
      aadhaarNumber: aadhaarNumber || '',
      documentURLs: documentURLs || [],
      previousSchool: previousSchool || null,
      siblingAdmissionNumbers: siblingAdmissionNumbers || [],
      emergencyContact: emergencyContact || null,
      transportRouteId: transportRouteId || '',
      transportStopName: transportStopName || '',
      transportFee: Number(transportFee || 0),
      annualEnrollmentFee: originalFee,
      commitmentFee: committedPayableFee,
      committedPayableFee,
      originalFeeAmount: originalFee,
      totalConcessionAmount: concessionAmount,
      feeHeads: body.feeHeads || null,
      totalFeeAmount,
      totalFeesDue,
      totalFeesPaid,
      feeStatus,
      attendancePercentage: 0,
      admissionStatus: requireApproval ? "pending" : "approved",
      searchKeywords: searchKeywords(studentName, admissionNumber, body.phone || phone || ""),
      feeLastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('students').add(studentData);

    // Keep studentFeeSummaries in sync from day one so finance pages
    // (dues, reminders, defaulters, dashboard) see this student before
    // any payment is recorded.
    const academicYearId = String(body.academicYearId || "");
    await db.collection("studentFeeSummaries").doc(`${docRef.id}_${academicYearId || "default"}`).set({
      studentId: docRef.id,
      schoolId,
      branchId: body.branchId || "default-branch",
      academicYearId,
      classId: body.classId || classStr,
      sectionId: body.sectionId || section,
      studentName,
      admissionNumber,
      phone: phone || body.fatherPhone || '',
      className: classStr,
      sectionName: section,
      totalFee: totalFeeAmount,
      totalPaid: 0,
      totalConcession: concessionAmount,
      committedPayableFee,
      originalFeeAmount: originalFee,
      dueAmount: totalFeesDue,
      updatedAt: new Date()
    }, { merge: true });

    // Raise an approval request only when approval is required.
    if (requireApproval) try {
      await createApprovalRequest({
        requestType: "admission",
        entityType: "student",
        entityId: docRef.id,
        title: `Admission: ${studentName} (${admissionNumber})`,
        description: `Class ${classStr}-${section}`,
        requestedBy: auth.uid,
        requestedByName: auth.name ?? auth.uid,
        payload: { admissionNumber, studentName, class: classStr, section }
      });
    } catch (approvalError) {
      console.error("Admission approval request failed (student still created):", approvalError);
    }

    await markSummaryDirty("student:create");

    return json({
      success: true,
      data: { id: docRef.id, ...studentData }
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return firestoreErrorResponse(error, 'Failed to create student');
  }
}

