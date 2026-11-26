import { FieldValue } from "firebase-admin/firestore";
import { driverCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { linkDriverToUser } from "@/lib/driverLink";

type StaffUser = {
  id: string;
  role?: unknown;
  status?: unknown;
  displayName?: unknown;
  name?: unknown;
  phone?: unknown;
  mobile?: unknown;
};

type DriverDoc = {
  uid?: string;
  name?: string;
  phone?: string;
  vehicleId?: string;
  status?: string;
};

type VehicleDoc = {
  id: string;
  regNo?: string;
  driverName?: string;
  driverUid?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function normalize(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

// POST /api/admin/transport/drivers/import-staff
// Creates the missing transport driver records for staff accounts whose role is
// "driver", links each to its login, and matches buses by driver name.
export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    const [usersSnap, driversSnap, vehiclesSnap] = await Promise.all([
      db.collection("users").where("role", "==", "driver").limit(500).get(),
      db.collection("drivers").limit(500).get(),
      db.collection("vehicles").limit(500).get()
    ]);

    const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StaffUser));
    const drivers = driversSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DriverDoc & { id: string }));
    const vehicles = vehiclesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VehicleDoc));

    const byUid = new Map<string, DriverDoc & { id: string }>();
    const byName = new Map<string, DriverDoc & { id: string }>();
    drivers.forEach((driver) => {
      if (text(driver.uid)) byUid.set(text(driver.uid), driver);
      const key = normalize(driver.name);
      if (key && !byName.has(key)) byName.set(key, driver);
    });

    const vehicleByName = new Map<string, VehicleDoc>();
    vehicles.forEach((vehicle) => {
      const key = normalize(vehicle.driverName);
      if (key && !vehicleByName.has(key)) vehicleByName.set(key, vehicle);
    });

    const created: string[] = [];
    const linked: { driverId: string; uid: string }[] = [];
    const failed: { uid: string; error: string }[] = [];
    let alreadyLinked = 0;

    const actorRole = (await resolveRole(token)) ?? "unknown";

    for (const user of users) {
      const uid = text(user.id);
      if (!uid) continue;
      const name = text(user.displayName) || text(user.name);
      if (!name) continue;

      const existingLinked = byUid.get(uid);
      if (existingLinked) {
        alreadyLinked += 1;
        continue;
      }

      const status = text(user.status) === "inactive" ? "inactive" : "active";
      const phone = text(user.phone) || text(user.mobile);
      const matchedVehicle = vehicleByName.get(normalize(name));

      let driver = byName.get(normalize(name));
      if (driver && text(driver.uid) && text(driver.uid) !== uid) {
        failed.push({ uid, error: `Driver record "${driver.name}" is already linked to another account` });
        continue;
      }

      const vehicleId = matchedVehicle?.id ?? text(driver?.vehicleId);

      if (!driver) {
        const parsed = driverCreateSchema.parse({
          name,
          phone,
          vehicleId,
          routeId: "",
          mode: "daily",
          uid: "",
          status,
          notes: "Imported from staff"
        });
        const now = FieldValue.serverTimestamp();
        const ref = await db.collection("drivers").add({
          ...parsed,
          salary: parsed.salary || null,
          createdAt: now,
          updatedAt: now
        });
        driver = { id: ref.id, ...parsed } as DriverDoc & { id: string };
        created.push(ref.id);
        byName.set(normalize(name), driver);
      } else if (vehicleId && !text(driver.vehicleId)) {
        await db.collection("drivers").doc((driver as { id: string }).id).set(
          { vehicleId, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        driver.vehicleId = vehicleId;
      }

      const driverId = (driver as { id: string }).id;
      const result = await linkDriverToUser({ driverId, uid, actorId: token.uid, actorRole });
      if (!result.ok) {
        failed.push({ uid, error: result.error });
        continue;
      }
      byUid.set(uid, driver);
      linked.push({ driverId, uid });

      if (matchedVehicle && (!text(matchedVehicle.driverUid) || text(matchedVehicle.driverUid) === uid)) {
        await db.collection("vehicles").doc(matchedVehicle.id).set(
          { driverUid: uid, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }

    return json({
      ok: true,
      staffDrivers: users.length,
      created: created.length,
      linked: linked.length,
      alreadyLinked,
      failed,
      vehiclesMatched: linked.filter((item) => {
        const driver = byUid.get(item.uid);
        return Boolean(driver && text(driver.vehicleId));
      }).length
    });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}
