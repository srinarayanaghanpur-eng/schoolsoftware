import { errorMessage, json, requireDriver } from "@/lib/apiUtils";
import {
  DriverAssignmentError,
  loadBaseline,
  resolveDriverAssignment,
  routeStops
} from "@/lib/driverAdmin";

export async function GET(req: Request) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  try {
    const { driver, vehicle, route, mode } = await resolveDriverAssignment(token.uid);
    const baseline = await loadBaseline(route.id);
    const routeKm = route.km ?? route.totalKm;

    return json({
      ok: true,
      assignment: {
        driverId: driver.id,
        name: driver.name,
        employeeId: driver.employeeId,
        phone: driver.phone,
        vehicleId: vehicle.id,
        busNo: vehicle.regNo,
        busModel: vehicle.model ?? "",
        capacity: vehicle.capacity,
        routeId: route.id,
        routeName: route.name,
        routeCode: route.code ?? "",
        routeKm,
        mode,
        baselineDate: baseline?.baselineDate,
        stops: routeStops(route)
      }
    });
  } catch (error) {
    if (error instanceof DriverAssignmentError) {
      return json({ ok: false, error: error.message }, { status: error.status });
    }
    return json({ ok: false, error: errorMessage(error, "Unable to load assignment") }, { status: 400 });
  }
}
