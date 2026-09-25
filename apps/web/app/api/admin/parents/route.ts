import { FieldValue } from "firebase-admin/firestore";
import { parentCreateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requirePermission, json } from "@/lib/apiUtils";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request) {
  try {
    const decodedToken = await requirePermission(req, "parents.view");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status")?.trim() ?? "";
    const classId = url.searchParams.get("classId")?.trim() ?? url.searchParams.get("class")?.trim() ?? "";
    const rawPageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize) ? rawPageSize : 50, 1), 100);
    const cursor = url.searchParams.get("cursor")?.trim() ?? "";
    const useCursor = cursor;

    const db = adminDb();
    type ParentRow = Record<string, unknown> & { uid: string; id: string };
    let parents: ParentRow[];
    let nextCursor: string | null = null;
    let hasMore = false;

    if (classId) {
      // Class filter: students of the class → their linked parent uids →
      // parent docs. Precise and bounded (class → ≤500 students).
      const studentSnap = await db.collection("students").where("class", "==", classId).limit(500).get();
      const studentIds = studentSnap.docs.map((d) => d.id);
      const parentUids = new Set<string>();
      for (let i = 0; i < studentIds.length; i += 30) {
        const chunk = studentIds.slice(i, i + 30);
        if (!chunk.length) break;
        const linkSnap = await db.collection("parent_student_links").where("studentId", "in", chunk).get();
        linkSnap.docs.forEach((d) => {
          const uid = (d.data() as Record<string, unknown>).parentUid;
          if (typeof uid === "string") parentUids.add(uid);
        });
      }
      parents = [];
      const uidList = [...parentUids].slice(0, 300);
      for (let i = 0; i < uidList.length; i += 30) {
        const chunk = uidList.slice(i, i + 30);
        const snap = await db.collection("users").where("__name__", "in", chunk).get();
        snap.docs.forEach((d) => parents.push({ uid: d.id, ...d.data(), id: d.id } as ParentRow));
      }
    } else {
      let query = db.collection("users").where("role", "==", "parent").orderBy("__name__");
      let cursorActive = Boolean(useCursor);
      if (useCursor) {
        const cursorSnap = await db.collection("users").doc(useCursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
        else cursorActive = false;
      }
      // Search widens the window (bounded 200) since matching is in-memory.
      let snapshot;
      try {
        snapshot = await query.limit(search ? Math.min(pageSize * 4, 200) : pageSize + 1).get();
      } catch (queryError: unknown) {
        // Missing composite (role + __name__): fall back to an unordered
        // bounded read; cursor paging disabled for this response.
        const message = queryError instanceof Error ? queryError.message : String(queryError);
        if (!(queryError as { code?: number })?.code || (queryError as { code?: number }).code === 9 || /FAILED_PRECONDITION|requires an index/i.test(message)) {
          snapshot = await db.collection("users").where("role", "==", "parent").limit(search ? 200 : pageSize + 1).get();
          cursorActive = false;
        } else {
          throw queryError;
        }
      }
      const docs = snapshot.docs.slice(0, search ? snapshot.docs.length : pageSize);
      hasMore = !search && cursorActive && snapshot.docs.length > pageSize;
      nextCursor = hasMore ? docs[docs.length - 1]?.id ?? null : null;
      parents = docs.map((doc) => ({ uid: doc.id, ...doc.data(), id: doc.id }) as ParentRow);
    }

    parents.sort((a, b) => String(a.displayName ?? "").localeCompare(String(b.displayName ?? "")));

    if (search) {
      parents = parents.filter((p) =>
        `${p.displayName} ${p.phone ?? ""} ${p.employeeId ?? ""}`
          .toLowerCase()
          .includes(search)
      );
    }
    // Missing status counts as active (field postdates older docs).
    if (statusFilter === "active") {
      parents = parents.filter((p) => p.status === undefined || p.status === "active");
    } else if (statusFilter === "inactive") {
      parents = parents.filter((p) => p.status === "inactive");
    }

    // Link counts for the page (one bounded query) so the UI can separate
    // linked vs unlinked parents without per-row reads.
    const linkCounts: Record<string, number> = {};
    const pageUids = parents.map((p) => String(p.uid));
    for (let i = 0; i < pageUids.length; i += 30) {
      const chunk = pageUids.slice(i, i + 30);
      if (!chunk.length) break;
      const linkSnap = await db.collection("parent_student_links").where("parentUid", "in", chunk).get();
      linkSnap.docs.forEach((d) => {
        const uid = String((d.data() as Record<string, unknown>).parentUid ?? "");
        if (uid) linkCounts[uid] = (linkCounts[uid] ?? 0) + 1;
      });
    }

    return json({ ok: true, parents, linkCounts, nextCursor, hasMore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load parents";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  let createdUid: string | undefined;

  try {
    const decodedToken = await requirePermission(req, "parents.create");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentCreateSchema.parse(body);
    const loginId = parsed.loginId.trim().toUpperCase();
    const internalEmail = employeeIdToInternalEmail(loginId);

    const db = adminDb();
    const existingUser = await db.collection("users").where("employeeId", "==", loginId).where("role", "==", "parent").limit(1).get();
    if (!existingUser.empty) {
      throw new Error("Login ID already exists for a parent account");
    }
    // Same phone on two parent logins means duplicate records / OTP confusion.
    // Guarded: if the composite index is missing the check is skipped rather
    // than blocking parent creation.
    const phone = parsed.phone.trim();
    try {
      const existingPhone = await db.collection("users").where("role", "==", "parent").where("phone", "==", phone).limit(1).get();
      if (!existingPhone.empty) {
        throw new Error("This phone number is already registered for another parent account");
      }
    } catch (phoneCheckError) {
      if (phoneCheckError instanceof Error && phoneCheckError.message.startsWith("This phone number")) throw phoneCheckError;
      console.warn("[ParentsAPI] phone-duplicate check skipped (needs role+phone index):", phoneCheckError instanceof Error ? phoneCheckError.message : phoneCheckError);
    }

    const authUser = await adminAuth().createUser({
      email: internalEmail,
      password: parsed.password,
      displayName: parsed.fullName.trim()
    });
    createdUid = authUser.uid;

    await adminAuth().setCustomUserClaims(authUser.uid, {
      role: "parent"
    });

    const timestamp = FieldValue.serverTimestamp();
    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      role: "parent",
      employeeId: loginId,
      internalEmail,
      displayName: parsed.fullName.trim(),
      phone: parsed.phone.trim(),
      email: parsed.email?.trim() || "",
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await writeAuditLog({
      action: "parent.created",
      entityType: "user",
      entityId: authUser.uid,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: { displayName: parsed.fullName.trim(), phone: parsed.phone.trim(), loginId }
    });

    return json({
      ok: true,
      message: "Parent login created successfully.",
      uid: authUser.uid
    });
  } catch (error) {
    if (createdUid) {
      await adminAuth().deleteUser(createdUid).catch(() => undefined);
    }
    return json({ ok: false, error: errorMessage(error, "Unable to create parent") }, { status: 400 });
  }
}

