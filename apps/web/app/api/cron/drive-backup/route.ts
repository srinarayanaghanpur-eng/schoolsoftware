import { timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot, Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, errorMessage, json, enforceBodyLimit } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export const dynamic = "force-dynamic";

/** One collection per invocation. Vercel cron entries are staggered 5 min apart. */
const BACKUP_COLLECTIONS = [
  "students",
  "teachers",
  "parents",
  "payments",
  "receipts",
  "attendance",
  "exams",
  "exam_marks",
  "fee_structures",
  "settings"
] as const;
type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

/** Only the settings collection is scanned for secrets, by exact field name. */
const SETTINGS_SECRET_FIELDS = [
  "biometricApiSecret",
  "whatsappApiKey",
  "smsApiKey",
  "maskedApiKey"
] as const;

const PAGE_SIZE = 500;

function timingSafeStringEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Still perform a comparison so a length mismatch is not observable.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Dual auth for the nightly backup, both timing-safe:
 *   1. Authorization: Bearer <CRON_SECRET>
 *   2. x-cron-secret: <CRON_SECRET>
 * Falls back to a signed-in admin (manual "run now"), matching the other cron routes.
 * With CRON_SECRET unset only admin auth is accepted.
 */
async function isAuthorizedCronCall(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (bearer && timingSafeStringEquals(bearer, secret)) return true;

    const cronHeader = req.headers.get("x-cron-secret") || "";
    if (cronHeader && timingSafeStringEquals(cronHeader, secret)) return true;
  }
  return Boolean(await requireAdmin(req));
}

function readCollection(req: Request): BackupCollection | null {
  const requested = new URL(req.url).searchParams.get("collection") || "";
  return (BACKUP_COLLECTIONS as readonly string[]).includes(requested)
    ? (requested as BackupCollection)
    : null;
}

/**
 * Pages through a collection 500 docs at a time (no unbounded single read).
 * For `settings`, the four secret fields are removed before serialisation and
 * their names are reported back so the backup log records what was stripped.
 */
async function collectDocs(
  name: BackupCollection
): Promise<{ docs: Record<string, unknown>[]; strippedFields: string[] }> {
  const db = adminDb();
  const docs: Record<string, unknown>[] = [];
  const stripped = new Set<string>();
  let cursor: QueryDocumentSnapshot | undefined;

  for (;;) {
    let query: Query = db.collection(name).orderBy("__name__").limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();

    for (const doc of snapshot.docs) {
      const payload: Record<string, unknown> = { ...doc.data() };
      if (name === "settings") {
        for (const field of SETTINGS_SECRET_FIELDS) {
          if (field in payload) {
            delete payload[field];
            stripped.add(field);
          }
        }
      }
      docs.push({ ...payload, id: doc.id });
    }

    if (snapshot.size < PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return { docs, strippedFields: [...stripped] };
}

/**
 * Google Drive REST client, implemented directly against the documented HTTP
 * endpoints. The `googleapis` package was tried first and abandoned: its type
 * definitions are so large that the combined lint + type-check worker exceeds
 * the Node heap during `next build` (the same inputs pass as standalone `tsc`
 * and `eslint`). This keeps the build inside its existing memory envelope.
 */
async function getDriveAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token"
    }).toString()
  });
  const payload = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Google Drive token exchange failed: ${payload.error_description || payload.error || `HTTP ${response.status}`}`
    );
  }
  return payload.access_token;
}

async function uploadToDrive(params: {
  collection: BackupCollection;
  exportedAt: string;
  body: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive backup credentials are not configured");
  }

  const accessToken = await getDriveAccessToken({ clientId, clientSecret, refreshToken });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  const fileName = `narayanaos-${params.collection}-${params.exportedAt.replace(/[:.]/g, "-")}.json`;
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    ...(folderId ? { parents: [folderId] } : {})
  };

  const boundary = "narayanaosdrivebackup";
  const payload = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    params.body,
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: payload
    }
  );

  const created = (await response.json()) as {
    id?: string;
    webViewLink?: string;
    error?: { message?: string };
  };
  if (!response.ok || !created.id) {
    throw new Error(`Google Drive upload failed: ${created.error?.message || `HTTP ${response.status}`}`);
  }

  return { fileId: created.id, webViewLink: created.webViewLink || "" };
}

async function writeBackupLog(entry: Record<string, unknown>): Promise<void> {
  try {
    await adminDb().collection("backup_logs").add({
      ...entry,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch {
    // A failed audit write must not mask the backup result.
  }
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  let collection: BackupCollection | null = null;

  try {
    if (!(await isAuthorizedCronCall(req))) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    collection = readCollection(req);
    if (!collection) {
      return json(
        {
          ok: false,
          error: `Missing or unknown collection. Allowed: ${BACKUP_COLLECTIONS.join(", ")}`
        },
        { status: 400 }
      );
    }

    const bodyLimit = enforceBodyLimit(req, 4096);
    if (bodyLimit) return bodyLimit;

    const limit = await checkRateLimit({
      key: `drive-backup:${collection}`,
      maxRequests: 20,
      windowMinutes: 60
    });
    if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

    const { docs, strippedFields } = await collectDocs(collection);
    const exportedAt = new Date().toISOString();
    const body = JSON.stringify(
      { collection, schoolId: process.env.SCHOOL_ID || "default-school", exportedAt, docCount: docs.length, docs },
      null,
      2
    );

    const uploaded = await uploadToDrive({ collection, exportedAt, body });
    const durationMs = Date.now() - startedAt;

    await writeBackupLog({
      collection,
      status: "ok",
      docCount: docs.length,
      strippedFields,
      driveFileId: uploaded.fileId,
      driveFileLink: uploaded.webViewLink,
      fileName: `narayanaos-${collection}-${exportedAt.replace(/[:.]/g, "-")}.json`,
      durationMs
    });

    return json({
      ok: true,
      collection,
      docCount: docs.length,
      strippedFields,
      driveFileId: uploaded.fileId,
      durationMs
    });
  } catch (error) {
    const message = errorMessage(error, "Backup failed");
    if (collection) {
      await writeBackupLog({
        collection,
        status: "error",
        docCount: 0,
        strippedFields: [],
        error: message,
        durationMs: Date.now() - startedAt
      });
    }
    return json({ ok: false, error: message }, { status: 400 });
  }
}
