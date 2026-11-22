import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebaseAdmin";
import { invalidateRoleCache } from "./apiUtils";
import { writeAuditLog } from "./auditLog";

const PRIVILEGED_ROLES = new Set(["super_admin", "admin", "settings_manager"]);

type DriverDoc = {
  uid?: string;
  name?: string;
  phone?: string;
  status?: string;
  vehicleId?: string;
  routeId?: string;
};

type LinkResult =
  | { ok: true; uid: string; driverId: string }
  | { ok: false; error: string; status: number };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function linkDriverToUser(params: {
  driverId: string;
  uid: string;
  actorId: string;
  actorRole: string;
}): Promise<LinkResult> {
  const { driverId, uid, actorId, actorRole } = params;
  if (!driverId || !uid) {
    return { ok: false, error: "Driver and user are required", status: 400 };
  }

  const driverSnap = await adminDb().collection("drivers").doc(driverId).get();
  if (!driverSnap.exists) {
    return { ok: false, error: "Driver not found", status: 404 };
  }
  const driver = (driverSnap.data() ?? {}) as DriverDoc;

  const auth = adminAuth();
  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/user-not-found") {
      return { ok: false, error: "User account not found", status: 404 };
    }
    throw error;
  }

  const userRef = adminDb().collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const targetRole = text(userData.role) || text(authUser.customClaims?.role);
  if (PRIVILEGED_ROLES.has(targetRole)) {
    return { ok: false, error: "Cannot link a privileged account as a driver", status: 403 };
  }

  const linkedSnap = await adminDb().collection("drivers").where("uid", "==", uid).limit(10).get();
  if (linkedSnap.docs.some((doc) => doc.id !== driverId)) {
    return { ok: false, error: "This account is already linked to another driver", status: 409 };
  }

  const status = driver.status ?? "active";
  const vehicleId = driver.vehicleId ?? "";
  const driverName = text(driver.name);
  const driverPhone = text(driver.phone);
  const userDisplayName = text(userData.displayName);
  const userPhone = text(userData.phone);

  await adminDb().collection("drivers").doc(driverId).set(
    { uid, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  const userPatch: Record<string, unknown> = {
    uid,
    role: "driver",
    driverId,
    vehicleId,
    status,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (driverName && !userDisplayName) userPatch.displayName = driverName;
  if (driverPhone && !userPhone) userPatch.phone = driverPhone;
  await userRef.set(userPatch, { merge: true });

  await auth.setCustomUserClaims(uid, {
    ...(authUser.customClaims ?? {}),
    role: "driver",
    driverId,
    vehicleId,
    status
  });
  await auth.revokeRefreshTokens(uid);
  invalidateRoleCache(uid);

  await writeAuditLog({
    action: "driver.linked",
    entityType: "driver",
    entityId: driverId,
    actorId,
    actorRole,
    oldValues: { uid: driver.uid ?? "" },
    newValues: { uid, driverId, vehicleId, status }
  });

  return { ok: true, uid, driverId };
}

export type LinkCandidate = {
  driverId: string;
  driverName: string;
  phone: string;
  vehicleId: string;
  routeId: string;
  candidateUid: string;
  candidateName: string;
  candidateRole: string;
  match: "phone" | "name";
  confidence: "exact";
  conflict?: string;
};

export type LinkMatchReport = {
  candidates: LinkCandidate[];
  conflicts: Array<{ driverId: string; driverName: string; reason: string }>;
  alreadyLinked: number;
  unmatched: number;
};

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function buildLinkMatches(): Promise<LinkMatchReport> {
  const db = adminDb();
  const [driversSnap, usersSnap, teachersSnap] = await Promise.all([
    db.collection("drivers").limit(300).get(),
    db.collection("users").limit(500).get(),
    db.collection("teachers").limit(300).get()
  ]);

  type LinkUser = {
    uid: string;
    role?: string;
    phone?: string;
    mobile?: string;
    displayName?: string;
    name?: string;
    fullName?: string;
  };

  const users: LinkUser[] = usersSnap.docs.map((doc) => ({
    ...(doc.data() as Omit<LinkUser, "uid">),
    uid: doc.id
  }));
  const teachers: LinkUser[] = teachersSnap.docs.map((doc) => ({
    ...(doc.data() as Omit<LinkUser, "uid">),
    uid: text(doc.data().uid)
  }));

  const byPhone = new Map<string, LinkUser[]>();
  const byName = new Map<string, LinkUser[]>();
  const add = (map: Map<string, LinkUser[]>, key: string, user: LinkUser) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(user);
    map.set(key, list);
  };

  users.forEach((user) => {
    const role = text(user.role);
    if (PRIVILEGED_ROLES.has(role)) return;
    add(byPhone, normalizePhone(user.phone), user);
    add(byPhone, normalizePhone(user.mobile), user);
    add(byName, normalizeName(user.displayName), user);
    add(byName, normalizeName(user.name), user);
  });
  teachers.forEach((teacher) => {
    const user = {
      uid: text(teacher.uid),
      displayName: teacher.fullName ?? teacher.name ?? "",
      phone: teacher.phone ?? "",
      role: "teacher"
    } as (typeof users)[number];
    if (!user.uid) return;
    if (users.some((item) => item.uid === user.uid)) return;
    add(byPhone, normalizePhone(user.phone), user);
    add(byName, normalizeName(user.displayName), user);
  });

  const candidates: LinkCandidate[] = [];
  const conflicts: LinkMatchReport["conflicts"] = [];
  let alreadyLinked = 0;
  let unmatched = 0;

  driversSnap.docs.forEach((doc) => {
    const driver = doc.data() as DriverDoc;
    if (text(driver.uid)) {
      alreadyLinked += 1;
      return;
    }

    const phoneKey = normalizePhone(driver.phone);
    const nameKey = normalizeName(driver.name);
    const phoneMatches = phoneKey ? byPhone.get(phoneKey) ?? [] : [];
    const nameMatches = nameKey ? byName.get(nameKey) ?? [] : [];
    const uniquePhone = Array.from(new Map(phoneMatches.map((user) => [user.uid, user])).values());
    const uniqueName = Array.from(new Map(nameMatches.map((user) => [user.uid, user])).values());

    let match: "phone" | "name" | null = null;
    let matched: (typeof users)[number] | undefined;
    if (uniquePhone.length === 1) {
      match = "phone";
      matched = uniquePhone[0];
    } else if (uniqueName.length === 1) {
      match = "name";
      matched = uniqueName[0];
    } else if (uniquePhone.length > 1 || uniqueName.length > 1) {
      conflicts.push({
        driverId: doc.id,
        driverName: text(driver.name),
        reason: uniquePhone.length > 1 ? "Phone matches multiple users" : "Name matches multiple users"
      });
      return;
    }

    if (!matched || !matched.uid) {
      unmatched += 1;
      return;
    }

    const candidateRole = text(matched.role);
    if (PRIVILEGED_ROLES.has(candidateRole)) {
      conflicts.push({
        driverId: doc.id,
        driverName: text(driver.name),
        reason: "Matched account is privileged"
      });
      return;
    }

    candidates.push({
      driverId: doc.id,
      driverName: text(driver.name),
      phone: text(driver.phone),
      vehicleId: text(driver.vehicleId),
      routeId: text(driver.routeId),
      candidateUid: matched.uid,
      candidateName: text(matched.displayName) || text(matched.name) || matched.uid,
      candidateRole: candidateRole || "user",
      match: match ?? "name",
      confidence: "exact"
    });
  });

  return { candidates, conflicts, alreadyLinked, unmatched };
}
