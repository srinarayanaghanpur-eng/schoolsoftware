import { FieldValue } from "firebase-admin/firestore";
import { academicYearCreateSchema, type AcademicYear } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import {
  firestoreErrorResponse,
  firestoreQuotaResponse,
  isFirestoreQuotaExceededError,
  isFirestoreQuotaPaused,
  pauseFirestoreAfterQuota
} from "@/lib/firebaseErrors";

const COLLECTION = "academic_years";
const ACADEMIC_YEARS_CACHE_MS = 5 * 60 * 1000;

let academicYearsCache: { years: AcademicYear[]; expiresAt: number } | null = null;

// GET /api/admin/academic-years — list all years (newest first), active flagged.
export async function GET(req: Request) {
  const token = await requirePermission(req, "academic_years.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const url = new URL(req.url);
  const canBypassCache = token.role === "principal" || token.role === "super_admin" || token.role === "settings_manager";
  const bypassCache = canBypassCache && url.searchParams.get("refresh") === "1";

  if (!bypassCache && academicYearsCache && academicYearsCache.expiresAt > Date.now()) {
    return json({ ok: true, years: academicYearsCache.years, cached: true });
  }

  if (isFirestoreQuotaPaused()) {
    if (academicYearsCache) {
      return json({ ok: true, years: academicYearsCache.years, cached: true, stale: true });
    }
    return firestoreQuotaResponse();
  }

  try {
    const snapshot = await adminDb().collection(COLLECTION).orderBy("startDate", "desc").limit(500).get();
    const years = snapshot.docs.map((doc) => serializeDoc<AcademicYear>(doc));
    academicYearsCache = { years, expiresAt: Date.now() + ACADEMIC_YEARS_CACHE_MS };
    return json({ ok: true, years });
  } catch (error) {
    if (isFirestoreQuotaExceededError(error) && academicYearsCache) {
      pauseFirestoreAfterQuota();
      return json({ ok: true, years: academicYearsCache.years, cached: true, stale: true });
    }
    return firestoreErrorResponse(error, "Unable to load academic years");
  }
}

// POST /api/admin/academic-years — create a year. Super admin only.
export async function POST(req: Request) {
  const token = await requirePermission(req, "academic_years.view");
  if (!token || (token.role !== "super_admin" && token.role !== "settings_manager")) {
    return json({ ok: false, error: "Super admin or settings manager access required" }, { status: 403 });
  }

  try {
    const parsed = academicYearCreateSchema.parse(await req.json());
    const db = adminDb();

    // Names are unique.
    const existing = await db.collection(COLLECTION).where("name", "==", parsed.name).limit(1).get();
    if (!existing.empty) {
      return json({ ok: false, error: "An academic year with that name already exists" }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      name: parsed.name,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      isActive: Boolean(parsed.isActive),
      createdAt: now,
      updatedAt: now
    });

    // If this one is active, deactivate the others (only one active year).
    if (parsed.isActive) {
      const others = await db.collection(COLLECTION).where("isActive", "==", true).limit(500).get();
      const batch = db.batch();
      others.docs.forEach((doc) => {
        if (doc.id !== ref.id) batch.update(doc.ref, { isActive: false, updatedAt: now });
      });
      await batch.commit();
    }

    academicYearsCache = null;
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to create academic year", 400);
  }
}
