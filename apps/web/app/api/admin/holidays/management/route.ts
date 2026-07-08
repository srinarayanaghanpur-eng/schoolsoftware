import { FieldValue } from "firebase-admin/firestore";
import type { Holiday, Role } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireRole, serializeDoc, errorMessage, json } from "@/lib/apiUtils";

const MANAGEMENT_ROLES: Role[] = ["super_admin", "principal", "settings_manager"];

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function monthRange(year: string, month: string): { start: string; end: string } {
  const y = Number(year);
  const m = Number(month);
  const start = `${year}-${month.padStart(2, "0")}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${year}-${month.padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
}

/**
 * GET /api/admin/holidays/management
 * List management-declared holidays with optional month/year/branch filters.
 */
export async function GET(req: Request) {
  try {
    const decodedToken = await requireRole(req, MANAGEMENT_ROLES.concat("teacher"));
    if (!decodedToken) {
      return json({ ok: false, error: "Access denied." }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = url.searchParams.get("year") ?? "";
    const month = url.searchParams.get("month") ?? "";
    const branchId = url.searchParams.get("branchId") ?? "";

    let query = adminDb().collection("holidays").where("type", "==", "management_declared");

    if (year && month && isValidDateKey(`${year}-${month.padStart(2, "0")}-01`)) {
      const { start, end } = monthRange(year, month);
      query = query.where("date", ">=", start).where("date", "<=", end);
    }

    query = query.orderBy("date", "desc");

    const snapshot = await query.get();
    const holidays = snapshot.docs.map((doc) => serializeDoc<Holiday>(doc));

    if (branchId) {
      return json({
        ok: true,
        holidays: holidays.filter((h) => !h.branchId || h.branchId === branchId || h.appliesToAllBranches)
      });
    }

    return json({ ok: true, holidays });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to load holidays") }, { status: 400 });
  }
}

/**
 * POST /api/admin/holidays/management
 * Create a single management-declared holiday.
 */
export async function POST(req: Request) {
  try {
    const decodedToken = await requireRole(req, MANAGEMENT_ROLES);
    if (!decodedToken) {
      return json({ ok: false, error: "Only admins and principals can declare holidays." }, { status: 403 });
    }

    const body = await req.json();
    const date = String(body.date ?? "").trim().slice(0, 10);
    const reason = String(body.reason ?? "").trim();

    if (!date) throw new Error("Holiday date is required.");
    if (!isValidDateKey(date)) throw new Error("Invalid date format. Use YYYY-MM-DD.");
    if (!reason) throw new Error("Reason is required.");

    const branchId = String(body.branchId ?? "").trim();
    const appliesToAllBranches = branchId ? false : body.appliesToAllBranches !== false;

    const docId = appliesToAllBranches ? `mgmt_${date}` : `mgmt_${date}_${branchId}`;
    const docRef = adminDb().collection("holidays").doc(docId);
    const existing = await docRef.get();

    if (existing.exists) {
      const data = existing.data() as Holiday;
      if (data.type === "management_declared" && data.isActive !== false) {
        return json(
          { ok: false, error: `Holiday already declared for ${date}.` },
          { status: 409 }
        );
      }
      // Reactivate a previously cancelled holiday.
      await docRef.set({
        isActive: true,
        reason,
        declaredByUserId: decodedToken.uid,
        declaredByName: body.declaredByName || "",
        declaredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        cancelledByUserId: FieldValue.delete(),
        cancelledAt: FieldValue.delete()
      }, { merge: true });
      return json({ ok: true, holiday: { id: docRef.id, date, reason }, message: "Holiday reactivated." });
    }

    let declaredByName = "";
    try {
      const userSnapshot = await adminDb().collection("users").doc(decodedToken.uid).get();
      const userData = userSnapshot.exists ? (userSnapshot.data() as { displayName?: string }) : undefined;
      declaredByName = userData?.displayName || (decodedToken.name as string) || "";
    } catch {
      declaredByName = (decodedToken.name as string) || "";
    }

    await docRef.set({
      date,
      title: "Management Declared Holiday",
      type: "management_declared",
      reason,
      declaredByUserId: decodedToken.uid,
      declaredByName,
      declaredAt: FieldValue.serverTimestamp(),
      branchId: appliesToAllBranches ? "" : branchId,
      appliesToAllBranches,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return json({ ok: true, holiday: { id: docRef.id, date, reason }, message: "Holiday declared." });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to declare holiday") }, { status: 400 });
  }
}

/**
 * PATCH /api/admin/holidays/management
 * Update a management holiday (reason, date, branch).
 */
export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireRole(req, MANAGEMENT_ROLES);
    if (!decodedToken) {
      return json({ ok: false, error: "Only admins and principals can edit holidays." }, { status: 403 });
    }

    const body = await req.json();
    const holidayId = String(body.holidayId ?? "").trim();
    if (!holidayId) throw new Error("Holiday id is required.");

    const docRef = adminDb().collection("holidays").doc(holidayId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Holiday not found.");

    const holiday = snapshot.data() as Holiday;
    if (holiday.type !== "management_declared") throw new Error("Only management holidays can be edited here.");

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    const reason = String(body.reason ?? "").trim();
    if (reason) updates.reason = reason;

    const date = String(body.date ?? "").trim().slice(0, 10);
    if (date) {
      if (!isValidDateKey(date)) throw new Error("Invalid date format.");
      updates.date = date;
    }

    await docRef.set(updates, { merge: true });

    return json({ ok: true, message: "Holiday updated." });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to update holiday") }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/holidays/management
 * Cancel (soft-delete) a management holiday.
 */
export async function DELETE(req: Request) {
  try {
    const decodedToken = await requireRole(req, MANAGEMENT_ROLES);
    if (!decodedToken) {
      return json({ ok: false, error: "Only admins and principals can cancel holidays." }, { status: 403 });
    }

    const url = new URL(req.url);
    const holidayId = url.searchParams.get("holidayId") ?? "";
    if (!holidayId) throw new Error("Holiday id is required.");

    const docRef = adminDb().collection("holidays").doc(holidayId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Holiday not found.");

    const holiday = snapshot.data() as Holiday;
    if (holiday.type !== "management_declared") throw new Error("Only management holidays can be cancelled here.");

    await docRef.set({
      isActive: false,
      cancelledByUserId: decodedToken.uid,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return json({ ok: true, message: "Holiday cancelled." });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to cancel holiday") }, { status: 400 });
  }
}

