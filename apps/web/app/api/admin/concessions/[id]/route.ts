import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";

const db = adminDb();

/**
 * GET /api/concessions/[id]
 * Get a specific concession
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docSnap = await db.collection('concessions').doc(params.id).get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: docSnap.id, ...docSnap.data() }
    });
  } catch (error) {
    console.error('Error fetching concession:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch concession' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/concessions/[id]
 * Update concession (approve/reject or edit pending)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, approvalNotes, concessionAmount, validUpto, userId } = body;

    const docRef = db.collection('concessions').doc(params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    const concession = docSnap.data();
    if (!concession) {
      return NextResponse.json(
        { success: false, error: 'Concession data is unavailable' },
        { status: 500 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
      updateData.approvalNotes = approvalNotes;
      updateData.approvedBy = userId;
      updateData.approvalDate = new Date();
      updateData.isActive = status === 'approved';

      // Add to history
      updateData.history = [
        ...(concession.history || []),
        {
          action: status === 'approved' ? 'approved' : 'rejected',
          changedBy: userId,
          changedAt: new Date(),
          oldData: { status: concession.status },
          newData: { status }
        }
      ];
    } else if (concession.status === 'pending') {
      // Edit pending concession
      const updates: any = {};
      if (concessionAmount !== undefined) {
        updates.concessionAmount = concessionAmount;
      }
      if (validUpto !== undefined) {
        updates.validUpto = new Date(validUpto);
      }

      updateData.history = [
        ...(concession.history || []),
        {
          action: 'edited',
          changedBy: userId,
          changedAt: new Date(),
          oldData: { ...updates },
          newData: updates
        }
      ];

      Object.assign(updateData, updates);
    }

    await docRef.update(updateData);

    // Log audit
    await db.collection('feeAuditLogs').add({
      action: 'concession_updated',
      entityType: 'concession',
      entityId: params.id,
      studentId: concession.studentId,
      changes: {
        oldData: { status: concession.status },
        newData: { status: updateData.status || concession.status }
      },
      userId,
      timestamp: new Date()
    });

    // Update student if approved
    if (status === 'approved') {
      const studentRef = db.collection('students').doc(concession.studentId);
      const studentSnap = await studentRef.get();

      if (studentSnap.exists) {
        const student = studentSnap.data() ?? {};
        await studentRef.update({
          totalConcessionAmount: ((student.totalConcessionAmount as number) || 0) + (concessionAmount || 0),
          activeConcessionCount: ((student.activeConcessionCount as number) || 0) + 1,
          concessionStatus: 'approved',
          feeLastUpdated: new Date()
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: params.id, ...concession, ...updateData }
    });
  } catch (error) {
    console.error('Error updating concession:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update concession' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/concessions/[id]
 * Delete concession (only pending)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json();

    const docRef = db.collection('concessions').doc(params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    const concession = docSnap.data();
    if (!concession) {
      return NextResponse.json(
        { success: false, error: 'Concession data is unavailable' },
        { status: 500 }
      );
    }

    if (concession.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Can only delete pending concessions' },
        { status: 400 }
      );
    }

    // Mark as rejected instead of deleting
    await docRef.update({
      status: 'rejected',
      isActive: false,
      updatedAt: new Date(),
      history: [
        ...(concession.history || []),
        {
          action: 'deleted',
          changedBy: userId,
          changedAt: new Date(),
          oldData: { status: concession.status },
          newData: { status: 'rejected' }
        }
      ]
    });

    // Log audit
    await db.collection('feeAuditLogs').add({
      action: 'concession_deleted',
      entityType: 'concession',
      entityId: params.id,
      studentId: concession.studentId,
      changes: {
        oldData: concession,
        newData: {}
      },
      userId,
      timestamp: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting concession:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete concession' },
      { status: 500 }
    );
  }
}
