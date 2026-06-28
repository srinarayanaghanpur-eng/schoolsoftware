import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";
import { createApprovalRequest } from "@/lib/approvalEngine";

const db = adminDb();

const CLASS_ORDER = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function nextClass(currentClass: string): string | null {
  const idx = CLASS_ORDER.indexOf(currentClass);
  if (idx === -1 || idx >= CLASS_ORDER.length - 1) return null;
  return CLASS_ORDER[idx + 1];
}

const COLLECTION = "promotions";

export async function GET(req: Request) {
  const token = await requirePermission(req, "promotions.view");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId");
    const promotionType = searchParams.get("promotionType");
    const status = searchParams.get("status");
    const classStr = searchParams.get("class");

    let query: FirebaseFirestore.Query = db.collection(COLLECTION).orderBy("createdAt", "desc");

    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (promotionType) query = query.where("promotionType", "==", promotionType);
    if (status) query = query.where("status", "==", status);
    if (classStr) query = query.where("fromClass", "==", classStr);

    const snapshot = await query.limit(500).get();
    const records = snapshot.docs.map((doc) => serializeDoc(doc));

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch promotions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "promotions.create");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { promotionType, academicYearId, studentIds, fromClass, fromSection, toClass, toSection, feeBalanceCarryForward, requireApproval, notes } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one student must be selected" }, { status: 400 });
    }

    if (!academicYearId) {
      return NextResponse.json({ ok: false, error: "Target academic year is required" }, { status: 400 });
    }

    const studentsSnapshot = await db.collection("students")
      .where("__name__", "in", studentIds.slice(0, 30))
      .get();

    if (studentsSnapshot.empty) {
      return NextResponse.json({ ok: false, error: "No students found for the given IDs" }, { status: 404 });
    }

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    const promotionIds: string[] = [];
    const promotionRecords: Record<string, unknown>[] = [];

    const firstStudent = studentsSnapshot.docs[0]?.data();
    const aggregateToClass = toClass || (firstStudent ? nextClass(firstStudent.class) || firstStudent.class : fromClass);
    const aggregateToSection = toSection || firstStudent?.section || "A";

    for (const doc of studentsSnapshot.docs) {
      const studentData = doc.data();
      const resolvedToClass = toClass || nextClass(studentData.class) || studentData.class;
      const resolvedToSection = toSection || studentData.section || "A";

      const record: Record<string, unknown> = {
        promotionType,
        academicYearId,
        fromAcademicYearId: studentData.academicYearId || "",
        studentId: doc.id,
        studentName: studentData.studentName || "",
        admissionNumber: studentData.admissionNumber || "",
        fromClass: studentData.class || fromClass,
        fromSection: studentData.section || fromSection,
        toClass: resolvedToClass,
        toSection: resolvedToSection,
        feeBalanceCarriedForward: feeBalanceCarryForward ? (studentData.totalFeesDue || 0) : 0,
        notes: notes || "",
        status: requireApproval ? "pending" : "completed",
        createdBy: token.uid,
        createdAt: now,
        updatedAt: now
      };

      if (promotionType === "detain") {
        record.toClass = studentData.class;
        record.toSection = studentData.section || "A";
      }

      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, record);
      promotionIds.push(ref.id);
      promotionRecords.push({ ...record, id: ref.id });

      const updateData: Record<string, unknown> = {
        class: record.toClass,
        section: record.toSection,
        academicYearId,
        updatedAt: now
      };

      if (feeBalanceCarryForward) {
        const existingDue = studentData.totalFeesDue || 0;
        const existingPaid = studentData.totalFeesPaid || 0;
        const totalFeeAmount = (studentData.annualEnrollmentFee || 0) + (studentData.commitmentFee || 0);
        updateData.totalFeesDue = existingDue;
        updateData.totalFeesPaid = existingPaid;
        updateData.totalFeeAmount = totalFeeAmount;
        updateData.feeStatus = existingDue <= 0 ? "paid" : existingPaid > 0 ? "partial" : "pending";
      }

      batch.update(db.collection("students").doc(doc.id), updateData);
    }

    if (requireApproval) {
      const approvalId = await createApprovalRequest({
        requestType: "promotion",
        entityType: "promotion",
        entityId: promotionIds.join(","),
        title: `Promotion: ${promotionRecords.length} student(s) to ${aggregateToClass}`,
        description: `${promotionType} - ${fromClass}${fromSection ? " " + fromSection : ""} → ${aggregateToClass}${aggregateToSection ? " " + aggregateToSection : ""}`,
        payload: { studentIds, promotionIds, promotionType, fromClass, fromSection, toClass, toSection, feeBalanceCarryForward },
        requestedBy: token.uid,
        academicYearId
      });

      for (const rec of promotionRecords) {
        batch.update(db.collection(COLLECTION).doc(rec.id as string), {
          approvalId
        });
      }
    }

    await batch.commit();

    for (const rec of promotionRecords) {
      await writeAuditLog({
        action: "student.promoted",
        entityType: "student",
        entityId: rec.studentId as string,
        actorId: token.uid,
        actorRole: token.role || "admin",
        newValues: rec as Record<string, unknown>,
        reason: notes || `Student ${promotionType}d from ${rec.fromClass}-${rec.fromSection}`,
        academicYearId
      });
    }

    return NextResponse.json({
      ok: true,
      count: promotionRecords.length,
      ids: promotionIds,
      records: promotionRecords
    });
  } catch (error) {
    console.error("Error processing promotion:", error);
    return NextResponse.json({ ok: false, error: "Failed to process promotion" }, { status: 500 });
  }
}
