import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

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
    const schoolId = searchParams.get("schoolId") || getSchoolId(auth);
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    let query: any = db.collection('concessions');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (studentId) {
      query = query.where('studentId', '==', studentId);
    }
    if (classStr) {
      query = query.where('class', '==', classStr);
    }
    if (academicYearId) {
      query = query.where("academicYearId", "==", academicYearId);
    }
    if (schoolId) {
      query = query.where("schoolId", "==", schoolId);
    }

    query = query.orderBy('createdAt', 'desc');

    if (cursor) {
      const cursorDoc = await db.collection("concessions").doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.limit(pageSize + 1).get();
    logFirestoreRead("ConcessionsAPI", "concessions", snapshot, { status, studentId, classStr, academicYearId, schoolId, pageSize });
    const pageDocs = snapshot.docs.slice(0, pageSize);
    const concessions = pageDocs.map((doc: { id: string; data: () => any }) => ({
      id: doc.id,
      ...doc.data()
    }));
    const nextCursor = snapshot.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

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
