import { NextRequest } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { createApprovalRequest } from "@/lib/approvalEngine";
import { writeAuditLog } from "@/lib/auditLog";
import { recalculateStudentFeeSummary } from "@/lib/feeRecalculation";
import { applyConcessionToState, resolveFeeState } from "@/lib/feeModel";

/**
 * GET /api/concessions/[id]
 * Get a specific concession
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = adminDb();
  try {
    const auth = await requirePermission(request, "fees.view");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const docSnap = await db.collection('concessions').doc(params.id).get();

    if (!docSnap.exists) {
      return json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      data: { id: docSnap.id, ...docSnap.data() }
    });
  } catch (error) {
    console.error('Error fetching concession:', error);
    return json(
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
  const db = adminDb();
  try {
    const auth = await requirePermission(request, "fees.edit");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status, approvalNotes, concessionAmount, validUpto } = body;
    const actorId = auth.uid;

    const docRef = db.collection('concessions').doc(params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    const concession = docSnap.data();
    if (!concession) {
      return json(
        { success: false, error: 'Concession data is unavailable' },
        { status: 500 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    if (status && (status === "approved" || status === "rejected")) {
      const studentId = String(concession.studentId || "").trim();
      if (status === "approved" && !studentId) {
        return json(
          { success: false, error: "Concession has no student assigned." },
          { status: 400 }
        );
      }

      const studentRef = studentId ? db.collection("students").doc(studentId) : null;
      const now = new Date();

      const outcome = await db.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(docRef);
        if (!freshSnap.exists) {
          return { error: "not_found" as const };
        }

        const fresh = freshSnap.data() ?? {};
        const currentStatus = String(fresh.status || "");
        if (currentStatus === "approved" && status === "approved") {
          return { alreadyProcessed: true as const, concession: fresh };
        }
        if (currentStatus !== "pending") {
          return { error: "not_pending" as const, currentStatus };
        }

        const studentSnap =
          status === "approved" && studentRef ? await transaction.get(studentRef) : null;
        if (status === "approved" && !studentSnap?.exists) {
          return { error: "student_not_found" as const };
        }

        const nextUpdate: Record<string, unknown> = {
          status,
          approvalNotes,
          approvedBy: actorId,
          approvalDate: now,
          isActive: status === "approved",
          history: [
            ...(Array.isArray(fresh.history) ? fresh.history : []),
            {
              action: status === "approved" ? "approved" : "rejected",
              changedBy: actorId,
              changedAt: now,
              oldData: { status: currentStatus },
              newData: { status }
            }
          ],
          updatedAt: now
        };

        transaction.update(docRef, nextUpdate);

        if (status === "approved" && studentRef && studentSnap) {
          const student = studentSnap.data() ?? {};
          const applied = applyConcessionToState(
            resolveFeeState(student as Record<string, unknown>),
            fresh.concessionAmount
          );
          transaction.update(studentRef, {
            ...applied,
            activeConcessionCount: Number(student.activeConcessionCount || 0) + 1,
            concessionStatus: "approved",
            feeLastUpdated: now,
            updatedAt: now
          });
        }

        return {
          update: nextUpdate,
          concession: fresh,
          previousStatus: currentStatus
        };
      });

      if ("error" in outcome) {
        if (outcome.error === "not_found") {
          return json(
            { success: false, error: "Concession not found" },
            { status: 404 }
          );
        }
        if (outcome.error === "student_not_found") {
          return json(
            { success: false, error: "Student not found for this concession." },
            { status: 404 }
          );
        }
        return json(
          {
            success: false,
            error: `Only pending concessions can be approved or rejected (current status: ${outcome.currentStatus || "unknown"}).`
          },
          { status: 409 }
        );
      }

      if ("alreadyProcessed" in outcome) {
        return json({
          success: true,
          alreadyProcessed: true,
          data: { id: params.id, ...outcome.concession }
        });
      }

      await writeAuditLog({
        action: status === "approved" ? "concession.added" : "concession.updated",
        entityType: "concession",
        entityId: params.id,
        actorId,
        actorRole: "admin",
        oldValues: { status: outcome.previousStatus } as Record<string, unknown>,
        newValues: {
          status,
          concessionAmount: outcome.concession.concessionAmount
        } as Record<string, unknown>,
        reason: approvalNotes ?? undefined
      });

      await createApprovalRequest({
        requestType: "concession",
        entityType: "concession",
        entityId: params.id,
        title: `Concession ${status} — ${outcome.concession.studentName || outcome.concession.studentId}`,
        description: approvalNotes || `${status} by ${actorId}`,
        requestedBy: actorId,
        payload: {
          ...body,
          concessionData: outcome.concession,
          finalStatus: status
        }
      });

      if (status === "approved" && studentId) {
        try {
          await recalculateStudentFeeSummary(studentId);
        } catch (summaryError) {
          console.error("Student summary recalc failed after concession approval:", summaryError);
        }
      }

      return json({
        success: true,
        data: { id: params.id, ...outcome.concession, ...outcome.update }
      });
    }

    if (concession.status === 'pending') {
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
          changedBy: actorId,
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
      userId: actorId,
      timestamp: new Date()
    });

    await writeAuditLog({
      action: 'concession.updated',
      entityType: 'concession',
      entityId: params.id,
      actorId,
      actorRole: "admin",
      oldValues: { status: concession.status } as Record<string, unknown>,
      newValues: { status: updateData.status || concession.status } as Record<string, unknown>,
      reason: approvalNotes ?? undefined
    });

    return json({
      success: true,
      data: { id: params.id, ...concession, ...updateData }
    });
  } catch (error) {
    console.error('Error updating concession:', error);
    return json(
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
  const db = adminDb();
  try {
    const auth = await requirePermission(request, "fees.delete");
    if (!auth) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const actorId = auth.uid;
    const docRef = db.collection('concessions').doc(params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return json(
        { success: false, error: 'Concession not found' },
        { status: 404 }
      );
    }

    const concession = docSnap.data();
    if (!concession) {
      return json(
        { success: false, error: 'Concession data is unavailable' },
        { status: 500 }
      );
    }

    if (concession.status !== 'pending') {
      return json(
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
          changedBy: actorId,
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
      userId: actorId,
      timestamp: new Date()
    });

    await writeAuditLog({
      action: "concession.deleted",
      entityType: "concession",
      entityId: params.id,
      actorId,
      actorRole: "admin",
      oldValues: { status: concession.status } as Record<string, unknown>,
      newValues: { status: "rejected" } as Record<string, unknown>
    });

    return json({ success: true });
  } catch (error) {
    console.error('Error deleting concession:', error);
    return json(
      { success: false, error: 'Failed to delete concession' },
      { status: 500 }
    );
  }
}

