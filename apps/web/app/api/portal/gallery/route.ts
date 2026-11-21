import { NextResponse } from "next/server";
import { hasPermission } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole, serializeDoc } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(token);
  if (!hasPermission(role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  try {
    const snap = await adminDb().collection("gallery_albums").orderBy("eventDate", "desc").limit(60).get();
    const albums = snap.docs
      .map((doc) => serializeDoc(doc))
      .filter((album) => ["parents", "public"].includes(String(album.visibility || "parents")))
      .map((album) => ({
        id: album.id,
        title: album.title,
        category: album.category ?? "",
        eventDate: album.eventDate ?? "",
        coverUrl: album.coverUrl ?? "",
        photoUrls: String(album.photoUrls ?? "")
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean)
      }));
    return NextResponse.json({ ok: true, albums }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load gallery" },
      { status: 500 }
    );
  }
}
