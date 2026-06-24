import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const loginId = searchParams.get("loginId")?.trim() ?? "";
    if (!loginId) return NextResponse.json({ ok: true, exists: false });

    const loginIdLower = loginId.toLowerCase();
    const teacherSnapshot = await adminDb()
      .collection("teachers")
      .where("employeeIdLower", "==", loginIdLower)
      .limit(1)
      .get();

    if (!teacherSnapshot.empty) {
      return NextResponse.json({ ok: true, exists: true });
    }

    const userSnapshot = await adminDb()
      .collection("users")
      .where("employeeId", "==", loginId.toUpperCase())
      .limit(1)
      .get();

    return NextResponse.json({ ok: true, exists: !userSnapshot.empty });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check login ID";
    return NextResponse.json({ ok: false, error: message, exists: false }, { status: 400 });
  }
}
