import { NextResponse } from "next/server";
import { buildDailyAttendanceRows } from "@sri-narayana/shared/services/reports";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { startTimer } from "@/lib/apiUtils";

export async function GET(req: Request) {
  const totalTimer = startTimer();
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken || (decodedToken.role !== "admin" && decodedToken.role !== "super_admin")) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  
  const dbTimer = startTimer();
  const [attendanceSnapshot, teachersSnapshot] = await Promise.all([
    adminDb().collection("attendance").where("date", "==", date).get(),
    adminDb().collection("teachers").where("status", "==", "active").limit(500).get()
  ]);
  const dbMs = dbTimer();

  const buildTimer = startTimer();
  const rows = buildDailyAttendanceRows(
    attendanceSnapshot.docs.map((doc) => doc.data() as any),
    teachersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as any)
  );
  const buildMs = buildTimer();
  
  const totalMs = totalTimer();
  console.log(`[API] /api/reports/daily - DB: ${dbMs}ms, Build: ${buildMs}ms, Total: ${totalMs}ms`);
  
  return NextResponse.json({ ok: true, rows, _metrics: { dbMs, buildMs, totalMs } });
}
