import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

function timeValue(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * GET /api/admin/concessions
 * Get all concession records with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "fees.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const studentId = searchParams.get('studentId');
    const classStr = searchParams.get('class');
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = searchParams.get("cursor")?.trim() || "";

    let query: FirebaseFirestore.Query = db.collection('concessions');
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    else if (schoolId) query = query.where("schoolId", "==", schoolId);
    else if (studentId) query = query.where("studentId", "==", studentId);
    else if (status) query = query.where("status", "==", status);

    const snapshot = await query.limit(500).get();
    logFirestoreRead("ConcessionsAPI", "concessions", snapshot, { status, studentId, classStr, academicYearId, schoolId, pageSize });
    const filteredDocs = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return (!status || String(data.status || "") === status)
          && (!studentId || String(data.studentId || "") === studentId)
          && (!classStr || String(data.class || "") === classStr)
          && (!academicYearId || String(data.academicYearId || "") === academicYearId)
          && (!schoolId || String(data.schoolId || "") === schoolId);
      })
      .sort((left, right) => timeValue(right.data().createdAt) - timeValue(left.data().createdAt));
    const startIndex = cursor ? Math.max(0, filteredDocs.findIndex((doc) => doc.id === cursor) + 1) : 0;
    const pageDocs = filteredDocs.slice(startIndex, startIndex + pageSize);
    const concessions = pageDocs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));
    const nextCursor = startIndex + pageSize < filteredDocs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ success: true, data: concessions, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    console.error('Error fetching concessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch concessions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/concessions
 * Create a new concession
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "fees.create");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const body = await request.json();
    const {
      studentId,
      admissionNumber,
      concessionType,
      concessionAmount,
      concessionPercent,
      reason,
      validFrom,
      validUpto,
      userId
    } = body;

    // Validation
    if (!studentId || !concessionType || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create concession
    const concessionData = {
      studentId,
      admissionNumber,
      class: body.class ?? "",
      section: body.section ?? "",
      academicYearId: String(body.academicYearId ?? "").trim(),
      schoolId: getSchoolId(auth),
      concessionType,
      concessionAmount: concessionAmount || 0,
      concessionPercent: concessionPercent || 0,
      reason,
      validFrom: new Date(validFrom),
      validUpto: new Date(validUpto),
      status: 'pending',
      isActive: false,
      attachments: [],
      history: [
        {
          action: 'created',
          changedBy: userId,
          changedAt: new Date(),
          oldData: {},
          newData: { status: 'pending' }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('concessions').add(concessionData);

    // Log audit
    await db.collection('feeAuditLogs').add({
      action: 'concession_created',
      entityType: 'concession',
      entityId: docRef.id,
      studentId,
      changes: {
        oldData: {},
        newData: concessionData
      },
      userId,
      timestamp: new Date()
    });

    return NextResponse.json(
      { success: true, data: { id: docRef.id, ...concessionData } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating concession:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create concession' },
      { status: 500 }
    );
  }
}
