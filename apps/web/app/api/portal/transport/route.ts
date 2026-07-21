import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(token.role as Role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });

  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });

  const db = adminDb();
  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const student = studentSnap.data() as Record<string, unknown>;

  const routeId = student.transportRouteId as string | undefined;
  const stopId = student.transportStopId as string | undefined;

  if (!routeId) {
    return NextResponse.json({ ok: true, transport: null, message: "No transport assigned." });
  }

  const routeSnap = await db.collection("transport_routes").doc(routeId).get();
  const route = routeSnap.exists ? (routeSnap.data() as Record<string, unknown>) : null;

  let stop = null;
  if (route && stopId) {
    const stops = (route.stops as Array<Record<string, unknown>>) || [];
    stop = stops.find((s) => String(s.id) === stopId) || null;
  }

  const vehicleId = route?.vehicleId as string | undefined;
  let vehicle = null;
  if (vehicleId) {
    const vehicleSnap = await db.collection("vehicles").doc(vehicleId).get();
    vehicle = vehicleSnap.exists ? (vehicleSnap.data() as Record<string, unknown>) : null;
  }

  return NextResponse.json({
    ok: true,
    transport: {
      route: route ? {
        id: routeSnap.id,
        name: route.name,
        driverName: route.driverName,
        driverPhone: route.driverPhone,
      } : null,
      stop: stop ? {
        name: stop.name,
        time: stop.time,
        pickupTime: stop.pickupTime,
        dropTime: stop.dropTime,
      } : null,
      vehicle: vehicle ? {
        number: vehicle.vehicleNumber,
        type: vehicle.type,
        capacity: vehicle.capacity,
      } : null,
    },
  });
}
