import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";import { BUS_FINANCE_COLLECTION, BUS_EMI_PAYMENTS_COLLECTION } from "@/lib/busFinanceService";
import type { BusEmiPayment, BusFinance } from "@/types/busFinance.types";

type ReportType =
  | "monthly"
  | "vehicle-wise"
  | "pending"
  | "overdue"
  | "yearly"
  | "company-wise";

/**
 * GET /api/admin/bus-finance/reports?type=...
 * Returns real-data report rows for the requested report. Optional filters:
 *   - month=YYYY-MM (monthly report)
 *   - year=YYYY     (yearly report)
 */
export async function GET(req: NextRequest) {
  const token = await requirePermission(req, "bus_finance.export");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "monthly") as ReportType;
    const monthFilter = searchParams.get("month"); // YYYY-MM
    const yearFilter = searchParams.get("year"); // YYYY
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 1000);
    const today = new Date().toISOString().slice(0, 10);

    const db = adminDb();

    // Pull only the EMI payments the requested report needs, filtered at the
    // database level, instead of the whole collection for every report type.
    let paymentsQuery: FirebaseFirestore.Query = db.collection(BUS_EMI_PAYMENTS_COLLECTION);
    let financeQuery: FirebaseFirestore.Query = db.collection(BUS_FINANCE_COLLECTION);
    if (academicYearId) {
      paymentsQuery = paymentsQuery.where("academicYearId", "==", academicYearId);
      financeQuery = financeQuery.where("academicYearId", "==", academicYearId);
    }
    if (schoolId) {
      paymentsQuery = paymentsQuery.where("schoolId", "==", schoolId);
      financeQuery = financeQuery.where("schoolId", "==", schoolId);
    }
    if (type === "monthly") {
      paymentsQuery = paymentsQuery.where("emiMonth", "==", monthFilter || today.slice(0, 7));
    } else if (type === "pending") {
      paymentsQuery = paymentsQuery.where("status", "in", ["pending", "partial"]);
    } else if (type === "overdue") {
      paymentsQuery = paymentsQuery.where("dueDate", "<", today);
    }

    const [financeSnap, paymentsSnap] = await Promise.all([
      financeQuery.limit(pageSize).get(),
      paymentsQuery.limit(Math.min(1000, pageSize * 10)).get(),
    ]);
    logFirestoreRead("BusFinanceReportsAPI", BUS_FINANCE_COLLECTION, financeSnap, { type, schoolId, academicYearId, pageSize });
    logFirestoreRead("BusFinanceReportsAPI", BUS_EMI_PAYMENTS_COLLECTION, paymentsSnap, { type, schoolId, academicYearId, pageSize: Math.min(1000, pageSize * 10) });

    const finances = financeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusFinance, "id">) }) as BusFinance);
    const financeById = new Map(finances.map((f) => [f.id, f]));
    const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusEmiPayment, "id">) }) as BusEmiPayment);

    const companyOf = (busFinanceId: string) => String(financeById.get(busFinanceId)?.financeCompany ?? "—");

    let rows: Record<string, unknown>[] = [];

    if (type === "monthly") {
      const month = monthFilter || today.slice(0, 7);
      rows = payments
        .filter((p) => String(p.emiMonth) === month)
        .map((p) => ({
          vehicleNumber: p.vehicleNumber,
          financeCompany: companyOf(p.busFinanceId),
          emiNumber: p.emiNumber,
          dueDate: p.dueDate,
          emiAmount: p.emiAmount,
          paidAmount: p.paidAmount ?? 0,
          status: p.status,
          paymentDate: p.paymentDate ?? null,
        }))
        .sort((a, b) => String(a.vehicleNumber).localeCompare(String(b.vehicleNumber)));
    } else if (type === "pending") {
      rows = payments
        .filter((p) => p.status === "pending" || p.status === "partial")
        .map((p) => ({
          vehicleNumber: p.vehicleNumber,
          financeCompany: companyOf(p.busFinanceId),
          emiNumber: p.emiNumber,
          dueDate: p.dueDate,
          emiAmount: p.emiAmount,
          paidAmount: p.paidAmount ?? 0,
          pendingAmount: (Number(p.emiAmount) || 0) - (Number(p.paidAmount) || 0),
          status: p.status,
        }))
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    } else if (type === "overdue") {
      rows = payments
        .filter((p) => p.status !== "paid" && String(p.dueDate) < today)
        .map((p) => ({
          vehicleNumber: p.vehicleNumber,
          financeCompany: companyOf(p.busFinanceId),
          emiNumber: p.emiNumber,
          dueDate: p.dueDate,
          emiAmount: p.emiAmount,
          paidAmount: p.paidAmount ?? 0,
          overdueAmount: (Number(p.emiAmount) || 0) - (Number(p.paidAmount) || 0),
          lateFee: p.lateFee ?? 0,
        }))
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    } else if (type === "vehicle-wise") {
      rows = finances
        .map((f) => {
          const ps = payments.filter((p) => p.busFinanceId === f.id);
          const paidAmount = ps.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
          const totalDue = (Number(f.emiAmount) || 0) * (Number(f.totalEmis) || 0);
          return {
            vehicleNumber: f.vehicleNumber,
            vehicleName: f.vehicleName,
            financeCompany: f.financeCompany,
            totalLoanAmount: f.totalLoanAmount ?? 0,
            totalEmis: f.totalEmis ?? 0,
            paidEmis: f.paidEmis ?? 0,
            pendingEmis: f.pendingEmis ?? 0,
            paidAmount,
            outstanding: Math.max(0, totalDue - paidAmount),
            status: f.status,
          };
        })
        .sort((a, b) => String(a.vehicleNumber).localeCompare(String(b.vehicleNumber)));
    } else if (type === "company-wise") {
      const byCompany = new Map<string, { financeCompany: string; loans: number; totalLoanAmount: number; paidAmount: number; outstanding: number }>();
      for (const f of finances) {
        const key = String(f.financeCompany ?? "—");
        const ps = payments.filter((p) => p.busFinanceId === f.id);
        const paidAmount = ps.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
        const totalDue = (Number(f.emiAmount) || 0) * (Number(f.totalEmis) || 0);
        const entry = byCompany.get(key) ?? { financeCompany: key, loans: 0, totalLoanAmount: 0, paidAmount: 0, outstanding: 0 };
        entry.loans += 1;
        entry.totalLoanAmount += Number(f.totalLoanAmount) || 0;
        entry.paidAmount += paidAmount;
        entry.outstanding += Math.max(0, totalDue - paidAmount);
        byCompany.set(key, entry);
      }
      rows = Array.from(byCompany.values()).sort((a, b) => a.financeCompany.localeCompare(b.financeCompany));
    } else if (type === "yearly") {
      const byYear = new Map<string, { year: string; paidAmount: number; emisPaid: number }>();
      for (const p of payments) {
        if (p.status !== "paid" && (Number(p.paidAmount) || 0) <= 0) continue;
        const dateStr = String(p.paymentDate || p.dueDate || "");
        const year = dateStr.slice(0, 4);
        if (!year) continue;
        if (yearFilter && year !== yearFilter) continue;
        const entry = byYear.get(year) ?? { year, paidAmount: 0, emisPaid: 0 };
        entry.paidAmount += Number(p.paidAmount) || 0;
        if (p.status === "paid") entry.emisPaid += 1;
        byYear.set(year, entry);
      }
      rows = Array.from(byYear.values()).sort((a, b) => a.year.localeCompare(b.year));
    } else {
      return NextResponse.json({ ok: false, error: "Unknown report type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, type, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build report";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
