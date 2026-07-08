import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { BUS_FINANCE_COLLECTION, generateEmiSchedule } from "@/lib/busFinanceService";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

/**
 * GET /api/admin/bus-finance
 * List all bus/vehicle finance (loan) records.
 */
export async function GET(req: NextRequest) {
  const token = await requirePermission(req, "bus_finance.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(BUS_FINANCE_COLLECTION);
    const status = searchParams.get("status") || "";
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    if (status) query = query.where("status", "==", status);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (schoolId) query = query.where("schoolId", "==", schoolId);
    query = query.orderBy("vehicleNumber", "asc");

    if (cursor) {
      const cursorDoc = await db.collection(BUS_FINANCE_COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snap = await query.limit(pageSize + 1).get();
    logFirestoreRead("BusFinanceAPI", BUS_FINANCE_COLLECTION, snap, { status, academicYearId, schoolId, pageSize });
    const pageDocs = snap.docs.slice(0, pageSize);
    const records = pageDocs.map((d) => serializeDoc(d) as Record<string, unknown> & { id: string });
    const nextCursor = snap.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return json({ ok: true, records, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bus finance records";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

const REQUIRED = [
  "vehicleName",
  "vehicleNumber",
  "financeCompany",
  "loanAccountNumber",
  "loanStartDate",
  "loanEndDate",
] as const;

/**
 * POST /api/admin/bus-finance
 * Create a new bus finance record and auto-generate its EMI schedule.
 */
export async function POST(req: NextRequest) {
  const token = await requirePermission(req, "bus_finance.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();

    for (const field of REQUIRED) {
      if (!body[field] || String(body[field]).trim() === "") {
        return json({ ok: false, error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const totalEmis = Math.floor(Number(body.totalEmis) || 0);
    const emiAmount = Number(body.emiAmount) || 0;
    const emiDueDay = Math.min(31, Math.max(1, Math.floor(Number(body.emiDueDay) || 1)));
    if (totalEmis <= 0) return json({ ok: false, error: "totalEmis must be greater than 0" }, { status: 400 });
    if (emiAmount <= 0) return json({ ok: false, error: "emiAmount must be greater than 0" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const vehicleNumber = String(body.vehicleNumber).trim();
    const schoolId = String(body.schoolId || getSchoolId(token));
    const academicYearId = String(body.academicYearId || "");

    const record: Record<string, unknown> = {
      schoolId,
      academicYearId,
      vehicleName: String(body.vehicleName).trim(),
      vehicleNumber,
      financeCompany: String(body.financeCompany).trim(),
      loanAccountNumber: String(body.loanAccountNumber).trim(),
      loanStartDate: String(body.loanStartDate),
      loanEndDate: String(body.loanEndDate),
      totalLoanAmount: Number(body.totalLoanAmount) || 0,
      downPayment: Number(body.downPayment) || 0,
      emiAmount,
      emiDueDay,
      totalEmis,
      paidEmis: 0,
      pendingEmis: totalEmis,
      interestRate: body.interestRate !== undefined && body.interestRate !== "" ? Number(body.interestRate) : null,
      status: "active",
      notes: body.notes ? String(body.notes) : "",
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb().collection(BUS_FINANCE_COLLECTION).add(record);

    // Auto-generate the monthly EMI schedule (idempotent).
    const generated = await generateEmiSchedule(ref.id, {
      vehicleNumber,
      emiAmount,
      totalEmis,
      schoolId,
      academicYearId,
      emiDueDay,
      loanStartDate: String(body.loanStartDate),
    });

    return json({ ok: true, id: ref.id, emisGenerated: generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bus finance record";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

