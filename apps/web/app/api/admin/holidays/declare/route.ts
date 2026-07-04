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

/** Declare a management holiday. Super Admin only. */
export async function POST(req: Request) {
  try {
    const decodedToken = await requireSuperAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Only the Super Admin can declare holidays." }, { status: 403 });
    }

    const body = await req.json();
    const date = String(body.date ?? "").trim().slice(0, 10);
    const reason = String(body.reason ?? "").trim();
    const branchId = String(body.branchId ?? "").trim();
    const appliesToAllBranches = branchId ? false : body.appliesToAllBranches !== false;

    if (!date) throw new Error("Holiday date is required.");
    if (!isValidDateKey(date)) throw new Error("Holiday date must be a valid date (YYYY-MM-DD).");
    if (!reason) throw new Error("Reason is required.");

    const db = adminDb();
    const existingSnapshot = await db
      .collection("holidays")
      .where("date", "==", date)
      .where("type", "==", "management_declared")
      .get();
    const duplicate = existingSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Holiday))
      .find(
        (holiday) =>
          isHolidayActive(holiday) &&
          (appliesToAllBranches || holidayAppliesToBranch(holiday, branchId))
      );
    if (duplicate) {
      return NextResponse.json({ ok: false, error: "Holiday already declared for this date." }, { status: 409 });
    }

    const name = await declaredByName(decodedToken.uid, decodedToken);
    const docId = appliesToAllBranches ? `mgmt_${date}` : `mgmt_${date}_${branchId}`;
    const docRef = db.collection("holidays").doc(docId);
    await docRef.set({
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

    return NextResponse.json({
      ok: true,
      holiday: { id: docRef.id, date, reason, type: "management_declared", appliesToAllBranches, branchId },
      message: "Holiday declared successfully."
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
