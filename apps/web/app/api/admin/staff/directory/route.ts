import { adminDb } from "@/lib/firebaseAdmin";
import { json, requirePermission } from "@/lib/apiUtils";

const OFFICE_ROLES = ["super_admin", "admin", "principal", "accountant", "settings_manager"];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sortByName(rows: Record<string, unknown>[], ...keys: string[]) {
  return rows.sort((left, right) => {
    const leftName = keys.map((key) => text(left[key])).find(Boolean) ?? "";
    const rightName = keys.map((key) => text(right[key])).find(Boolean) ?? "";
    return leftName.localeCompare(rightName);
  });
}

function userKeys(user: Record<string, unknown>) {
  return [user.id, user.uid, user.teacherId, user.email, user.internalEmail, user.employeeId]
    .map(text)
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

// GET /api/admin/staff/directory — role-wise staff groups for the directory.
export async function GET(req: Request) {
  const token = await requirePermission(req, "staff.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const [teachersSnap, driversSnap, officeSnap, teacherUsersSnap] = await Promise.all([
    // No orderBy: legacy teacher docs without `fullName` must still be listed.
    db.collection("teachers").limit(300).get(),
    db.collection("drivers").limit(150).get(),
    db.collection("users").where("role", "in", OFFICE_ROLES).limit(150).get(),
    // Teacher login profiles live in `users`; any that lack a matching
    // `teachers` master record surface under Other/Unassigned.
    db.collection("users").where("role", "==", "teacher").limit(250).get()
  ]);

  const teachers = sortByName(
    teachersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
    "fullName",
    "name",
    "displayName",
    "employeeId"
  );
  const drivers = sortByName(
    driversSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
    "name",
    "fullName",
    "phone",
    "mobile"
  );

  const teacherKeys = new Set(teachers.flatMap(userKeys));
  const office: Record<string, unknown>[] = officeSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })
  );
  const other = teacherUsersSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown>)
    .filter((user) => !userKeys(user).some((key) => teacherKeys.has(key)));

  sortByName(office, "displayName", "fullName", "name", "email", "employeeId");
  sortByName(other, "displayName", "fullName", "name", "email", "employeeId");

  return json({ ok: true, teachers, drivers, office, other });
}
