import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { createApprovalRequest } from "@/lib/approvalEngine";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { firestoreErrorResponse, firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";

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
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    if (isFirestoreQuotaPaused()) {
      return firestoreQuotaResponse();
    }

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const classStr = searchParams.get('class');
    const section = searchParams.get('section');
    const branchId = searchParams.get("branchId") || "";
    const academicYearId = searchParams.get("academicYearId") || "";
    const classId = searchParams.get("classId") || classStr || "";
    const sectionId = searchParams.get("sectionId") || section || "";
    const status = searchParams.get("status") || "";
    const q = searchParams.get("q")?.trim() || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    const applyScope = (baseQuery: any) => {
      let scoped = baseQuery;
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
      return NextResponse.json({ success: true, count: Number(countSnap.data().count || 0) });
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

    const snapshot = await query.get();
    logFirestoreRead("StudentsAPI", "students", snapshot, { branchId, academicYearId, classId, sectionId, status, q: q || "none", pageSize });
    const pageDocs = canUseCursorPaging ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
    const students = pageDocs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));

    const nextCursor = canUseCursorPaging && snapshot.docs.length > pageSize && pageDocs.length > 0
      ? pageDocs[pageDocs.length - 1].id
      : null;

    return NextResponse.json({ success: true, data: students, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
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
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const body = await request.json();
    const {
      admissionNumber,
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

    // Validation
    if (!admissionNumber || !studentName || !classStr || !section) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if admission number already exists
    const existingSnapshot = await db
      .collection('students')
      .where('admissionNumber', '==', admissionNumber)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Admission number already exists' },
        { status: 400 }
      );
    }

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

    const annualEnrollmentFee = Number(body.annualEnrollmentFee || 0);
    const commitmentFee = Number(body.commitmentFee || 0);
    const totalFeeAmount = annualEnrollmentFee + commitmentFee;
    const totalFeesPaid = 0;
    const totalFeesDue = totalFeeAmount;
    const feeStatus = totalFeeAmount > 0 ? 'pending' : 'paid';

    // Create student document
    const studentData: Record<string, unknown> = {
      admissionNumber,
      admissionNo: admissionNumber,
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
      annualEnrollmentFee,
      commitmentFee,
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

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, ...studentData }
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return firestoreErrorResponse(error, 'Failed to create student');
  }
}
