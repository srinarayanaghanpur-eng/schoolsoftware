import { NextResponse } from "next/server";
import { serializeDoc, requireTeacher } from "@/lib/apiUtils";
import { adminDb } from "@/lib/firebaseAdmin";
import type { SalaryReport } from "@sri-narayana/shared";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireTeacher(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const db = adminDb();

    // Get all salary reports for the authenticated teacher for the specified month
    const snapshot = await db
      .collection("salary_reports")
      .where("teacherId", "==", decodedToken.uid)
      .where("month", "==", month)
      .get();

    const reports = snapshot.docs.map((doc) => serializeDoc<SalaryReport>(doc));

    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load salary reports";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
