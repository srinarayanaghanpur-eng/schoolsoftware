import { adminDb } from "@/lib/firebaseAdmin";
import { json, requirePermission } from "@/lib/apiUtils";

const OFFICE_ROLES = ["super_admin", "admin", "principal", "accountant", "settings_manager"];

// GET /api/admin/staff/directory — role-wise staff groups for the directory.
export async function GET(req: Request) {
  const token = await requirePermission(req, "staff.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const [teachersSnap, driversSnap, usersSnap] = await Promise.all([
    db.collection("teachers").orderBy("fullName").limit(200).get(),
    db.collection("drivers").orderBy("name").limit(100).get(),
    db.collection("users").where("role", "in", OFFICE_ROLES).limit(100).get()
  ]);

  const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  const drivers = driversSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  const office = usersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

  return json({ ok: true, teachers, drivers, office });
}
