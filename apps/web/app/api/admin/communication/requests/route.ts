import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";
import { firestoreErrorResponse, isFirestoreQuotaPaused, firestoreQuotaResponse } from "@/lib/firebaseErrors";
import { readLimit } from "@/lib/firestoreReadLogger";
import {
  ALL_TYPES,
  REQUEST_SOURCES,
  nativeStatusFor,
  normalizeRequest,
  searchHaystack,
  sourceForType,
  type FilterStatus,
  type NormalizedRequest,
  type RequestType
} from "@/lib/communicationRequests";

export const dynamic = "force-dynamic";

// GET /api/admin/communication/requests
// Unified, paginated list across password-reset / leave / attendance-edit
// collections. Query params: type, status, startDate, endDate, search,
// pageSize, cursor (ISO timestamp). Never reads a full collection — every
// source query is bounded by pageSize and ordered by its date field desc.
export async function GET(req: Request) {
  const token = await requireAdmin(req);
  if (!token) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

  if (isFirestoreQuotaPaused()) return firestoreQuotaResponse();

  const { searchParams } = new URL(req.url);

  // count=1 → cheap aggregate of pending items only (1 read per source), for
  // the header badge. Password "open" + leave "pending".
  if (searchParams.get("count") === "1") {
    try {
      const counts = await Promise.all(
        ALL_TYPES.filter((t) => REQUEST_SOURCES[t].hasStatus).map(async (type) => {
          const source = REQUEST_SOURCES[type];
          const native = nativeStatusFor(source, "pending");
          if (!native) return 0;
          const snap = await adminDb().collection(source.collection).where("status", "==", native).count().get();
          return Number(snap.data().count || 0);
        })
      );
      return NextResponse.json({ ok: true, pendingCount: counts.reduce((a, b) => a + b, 0) });
    } catch (error) {
      return firestoreErrorResponse(error, "Unable to count requests");
    }
  }

  const typeParam = (searchParams.get("type") || "all") as RequestType | "all";
  const status = (searchParams.get("status") || "pending") as FilterStatus;
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = searchParams.get("cursor") || "";

  // Which sources to query. A specific status tab (pending/approved/rejected)
  // only applies to sources that carry a status, so drop audit logs there
  // unless the user explicitly asked for the attendance_edit type.
  let types: RequestType[] = typeParam === "all" ? [...ALL_TYPES] : [typeParam];
  if (["pending", "approved", "rejected"].includes(status) && typeParam === "all") {
    types = types.filter((t) => REQUEST_SOURCES[t].hasStatus);
  }

  try {
    const perSource = await Promise.all(
      types.map(async (type) => {
        const source = REQUEST_SOURCES[type];
        let query: FirebaseFirestore.Query = adminDb().collection(source.collection);

        if (status === "archived") {
          query = query.where("archived", "==", true);
        } else if (status !== "all" && source.hasStatus) {
          const native = nativeStatusFor(source, status as NormalizedRequest["status"]);
          if (native === null) return [] as NormalizedRequest[]; // status not valid for this source
          query = query.where("status", "==", native);
        } else if (status !== "all" && !source.hasStatus) {
          // e.g. requesting "pending" on audit logs → nothing.
          return [] as NormalizedRequest[];
        }

        if (startDate) query = query.where(source.dateField, ">=", startDate);
        if (endDate) query = query.where(source.dateField, "<=", `${endDate}T23:59:59.999Z`);
        if (cursor) query = query.where(source.dateField, "<", cursor);

        const snap = await query.orderBy(source.dateField, "desc").limit(pageSize).get();
        return snap.docs.map((doc) => normalizeRequest(source, doc));
      })
    );

    let merged = perSource.flat();

    // Hide soft-deleted everywhere; hide archived unless on the Archived tab.
    merged = merged.filter((r) => !r.deletedAt);
    if (status !== "archived") merged = merged.filter((r) => !r.archived);

    if (search) merged = merged.filter((r) => searchHaystack(r).includes(search));

    merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const rawCount = merged.length;
    const page = merged.slice(0, pageSize);
    const hasMore = rawCount > pageSize || perSource.some((docs) => docs.length === pageSize);
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].createdAt : null;

    return NextResponse.json({ ok: true, requests: page, pageSize, nextCursor, hasMore });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to load requests");
  }
}
