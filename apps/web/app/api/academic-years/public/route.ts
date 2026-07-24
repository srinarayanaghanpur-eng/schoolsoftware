import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  firestoreErrorResponse,
  firestoreQuotaResponse,
  isFirestoreQuotaExceededError,
  isFirestoreQuotaPaused,
  pauseFirestoreAfterQuota
} from "@/lib/firebaseErrors";

const COLLECTION = "academic_years";
const CACHE_MS = 5 * 60 * 1000;

type PublicYear = { id: string; name: string; isActive: boolean };

let cache: { years: PublicYear[]; expiresAt: number } | null = null;

// GET /api/academic-years/public — minimal pre-login list of academic years.
// No auth (mirrors login-id/check): exposes only year labels, low sensitivity.
export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, years: cache.years, cached: true });
  }

  if (isFirestoreQuotaPaused()) {
    if (cache) {
      return NextResponse.json({ ok: true, years: cache.years, cached: true, stale: true });
    }
    return firestoreQuotaResponse();
  }

  try {
    const snapshot = await adminDb().collection(COLLECTION).orderBy("startDate", "desc").get();
    const years: PublicYear[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: typeof data.name === "string" ? data.name : "",
        isActive: Boolean(data.isActive)
      };
    });
    cache = { years, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json({ ok: true, years });
  } catch (error) {
    if (isFirestoreQuotaExceededError(error) && cache) {
      pauseFirestoreAfterQuota();
      return NextResponse.json({ ok: true, years: cache.years, cached: true, stale: true });
    }
    return firestoreErrorResponse(error, "Unable to load academic years");
  }
}
