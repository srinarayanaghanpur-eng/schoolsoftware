import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";

/**
 * POST /api/admin/reset-app — fresh-start reset.
 *
 * Wipes all transactional app data while PRESERVING:
 *  - Logins & roles:  users (Firebase Auth accounts are never touched)
 *  - Staff:           teachers (drivers included), vehicles, transport_routes
 *  - Payroll:         salary_reports, salary_advances, attendance,
 *                     leave_requests, holidays (salary stays regenerable)
 *  - Configuration:   academic_years, settings, fee_structures, branches
 *  - Audit trails:    admin/backup/audit + payroll access audit logs
 *
 * Everything else (students, parents, payments, receipts, fee/finance
 * summaries, expenses, incomes, exams, notices, library, hostel, inventory,
 * approvals, counters...) is discovered at runtime and deleted, so newly
 * added modules are reset automatically.
 */
const PRESERVED_COLLECTIONS = new Set([
  // logins & roles
  "users",
  // staff & transport setup (drivers live in teachers/vehicles docs)
  "teachers",
  "vehicles",
  "transport_routes",
  // payroll & its inputs
  "salary_reports",
  "salary_advances",
  "attendance",
  "leave_requests",
  "holidays",
  // school configuration
  "academic_years",
  "settings",
  "fee_structures",
  "branches",
  // audit trails (tamper-evident history of admin actions incl. this reset)
  "backup_audit_logs",
  "admin_audit_logs",
  "audit_logs",
  "payroll_access_audit_logs"
]);

const CONFIRMATION_PHRASE = "RESET APP DATA";

async function deleteCollection(collectionName: string) {
  const db = adminDb();
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }

  return deleted;
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const confirmationPhrase = String(body.confirmationPhrase ?? "").trim();
    if (confirmationPhrase !== CONFIRMATION_PHRASE) {
      return NextResponse.json(
        { ok: false, error: `Confirmation phrase does not match. Type exactly: ${CONFIRMATION_PHRASE}` },
        { status: 400 }
      );
    }

    const db = adminDb();
    const allCollections = await db.listCollections();
    const deletedCounts: Record<string, number> = {};
    const preserved: string[] = [];

    for (const collection of allCollections) {
      if (PRESERVED_COLLECTIONS.has(collection.id)) {
        preserved.push(collection.id);
        continue;
      }
      deletedCounts[collection.id] = await deleteCollection(collection.id);
    }

    await db.collection("admin_audit_logs").add({
      action: "reset_app_data",
      preservedCollections: preserved,
      deletedCounts,
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid
    });

    return NextResponse.json({ ok: true, deletedCounts, preserved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset app data";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
