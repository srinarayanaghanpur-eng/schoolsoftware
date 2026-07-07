import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { holidayAppliesToBranch, isHolidayActive, type AppUser, type Holiday } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";

async function requireSuperAdmin(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  return role === "super_admin" ? decodedToken : null;
}

async function declaredByName(uid: string, token: DecodedIdToken): Promise<string> {
  try {
    const snapshot = await adminDb().collection("users").doc(uid).get();
    const user = snapshot.exists ? (snapshot.data() as AppUser) : undefined;
    if (user?.displayName) return user.displayName;
  } catch {
    // Fall back to token identity below.
  }
  return (token.name as string) || token.email || "Super Admin";
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function expandDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Declare a management holiday for a single date or a from–to range. Super Admin only. */
export async function POST(req: Request) {
  try {
    const decodedToken = await requireSuperAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Only the Super Admin can declare holidays." }, { status: 403 });
    }

    const body = await req.json();
    const fromDate = String(body.fromDate ?? body.date ?? "").trim().slice(0, 10);
    const toDate = String(body.toDate ?? fromDate).trim().slice(0, 10) || fromDate;
    const reason = String(body.reason ?? "").trim();
    const branchId = String(body.branchId ?? "").trim();
    const appliesToAllBranches = branchId ? false : body.appliesToAllBranches !== false;

    if (!fromDate) throw new Error("Holiday date is required.");
    if (!isValidDateKey(fromDate) || !isValidDateKey(toDate)) throw new Error("Holiday dates must be valid dates (YYYY-MM-DD).");
    if (toDate < fromDate) throw new Error("To date cannot be before from date.");
    if (!reason) throw new Error("Reason is required.");

    const dates = expandDateRange(fromDate, toDate);
    if (dates.length > 31) throw new Error("Holiday range cannot be longer than 31 days.");

    const db = adminDb();
    // Single-field range query only — an extra equality filter on `type`
    // would require a composite Firestore index; filter type in code instead.
    const existingSnapshot = await db
      .collection("holidays")
      .where("date", ">=", fromDate)
      .where("date", "<=", toDate)
      .limit(100)
      .get();
    const alreadyDeclared = new Set(
      existingSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Holiday))
        .filter(
          (holiday) =>
            holiday.type === "management_declared" &&
            isHolidayActive(holiday) &&
            (appliesToAllBranches || holidayAppliesToBranch(holiday, branchId))
        )
        .map((holiday) => holiday.date.slice(0, 10))
    );

    const newDates = dates.filter((date) => !alreadyDeclared.has(date));
    if (newDates.length === 0) {
      return NextResponse.json(
        { ok: false, error: dates.length === 1 ? "Holiday already declared for this date." : "Holiday already declared for all dates in this range." },
        { status: 409 }
      );
    }

    const name = await declaredByName(decodedToken.uid, decodedToken);
    const batch = db.batch();
    for (const date of newDates) {
      const docId = appliesToAllBranches ? `mgmt_${date}` : `mgmt_${date}_${branchId}`;
      batch.set(db.collection("holidays").doc(docId), {
        date,
        title: "Management Declared Holiday",
        type: "management_declared",
        reason,
        declaredByUserId: decodedToken.uid,
        declaredByName: name,
        declaredAt: FieldValue.serverTimestamp(),
        branchId: appliesToAllBranches ? "" : branchId,
        appliesToAllBranches,
        isActive: true,
        cancelledByUserId: FieldValue.delete(),
        cancelledAt: FieldValue.delete(),
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();

    const skipped = dates.filter((date) => alreadyDeclared.has(date));
    const message =
      newDates.length === 1 && skipped.length === 0
        ? "Holiday declared successfully."
        : `Holiday declared successfully for ${newDates.length} day(s).${skipped.length ? ` Already declared: ${skipped.join(", ")}.` : ""}`;

    return NextResponse.json({
      ok: true,
      declaredDates: newDates,
      skippedDates: skipped,
      message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to declare holiday";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/** Cancel a wrongly declared holiday (soft delete). Super Admin only. */
export async function PATCH(req: Request) {
  try {
    const decodedToken = await requireSuperAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Only the Super Admin can cancel declared holidays." }, { status: 403 });
    }

    const body = await req.json();
    const holidayId = String(body.holidayId ?? "").trim();
    if (!holidayId) throw new Error("Holiday id is required.");

    const docRef = adminDb().collection("holidays").doc(holidayId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Holiday was not found.");
    const holiday = snapshot.data() as Holiday;
    if (holiday.type !== "management_declared") throw new Error("Only management declared holidays can be cancelled here.");
    if (!isHolidayActive(holiday)) throw new Error("This holiday is already cancelled.");

    await docRef.set({
      isActive: false,
      cancelledByUserId: decodedToken.uid,
      cancelledAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({ ok: true, message: "Holiday cancelled successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel holiday";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
