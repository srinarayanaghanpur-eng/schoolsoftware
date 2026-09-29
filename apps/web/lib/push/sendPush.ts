import { createHash } from "node:crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Expo push delivery (Phase 1).
 *
 * Privacy contract: title/body may include the child's FIRST name and fee
 * amounts only. Never include phone, address, full name or ID numbers —
 * that is the CALLER's responsibility; this module transports opaquely.
 *
 * Reliability contract: sendPushToUsers has a hard time budget and NEVER
 * throws. A push failure must never fail the primary write that triggered
 * it — call it fire-and-forget.
 */

const EXPO_TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;

export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && EXPO_TOKEN_RE.test(token);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const pushRegisterSchema = z.object({
  token: z.string().min(1).max(500).refine(isValidExpoPushToken, "Invalid push token"),
  platform: z.enum(["android", "ios"]).optional()
});

export const pushUnregisterSchema = z.object({
  token: z.string().min(1).max(500).refine(isValidExpoPushToken, "Invalid push token")
});

export type PushMessage = {
  title: string;
  body: string;
  route?: string;
  data?: Record<string, string | number | boolean>;
};

export type PushResult = { sent: number; failed: number; removed: number };

const ZERO_RESULT: PushResult = { sent: 0, failed: 0, removed: 0 };

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const PUSH_CHUNK_SIZE = 100;
const RECEIPT_CHUNK_SIZE = 300;
const FETCH_TIMEOUT_MS = 5000;
const PUSH_TIME_BUDGET_MS = 8000;
const TOKEN_LOOKUP_CHUNK = 30; // Firestore `in` supports at most 30 values

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoReceipt = {
  status: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoReceiptMap = Record<string, ExpoReceipt>;

/** Split an array into chunks of at most `size` (Expo send limit is 100). */
export function chunkTokens<T>(items: T[], size: number = PUSH_CHUNK_SIZE): T[][] {
  if (size <= 0) return items.length > 0 ? [items] : [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildPayload(token: string, message: PushMessage): Record<string, unknown> {
  return {
    to: token,
    title: message.title,
    body: message.body,
    data: { ...(message.data ?? {}), ...(message.route ? { route: message.route } : {}) },
    // Matches the Android channel the client creates at startup.
    channelId: "default"
  };
}

/**
 * Tokens whose ticket OR delivery receipt reports DeviceNotRegistered.
 * Returns each dead token once.
 */
export function findDeadTokens(
  tickets: Array<{ token: string; ticket: ExpoTicket }>,
  receipts: ExpoReceiptMap
): string[] {
  const dead = new Set<string>();
  for (const { token, ticket } of tickets) {
    if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") dead.add(token);
      continue;
    }
    const receipt = receipts[ticket.id];
    if (receipt?.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
      dead.add(token);
    }
  }
  return [...dead];
}

type PushDeps = {
  fetchFn?: typeof fetch;
  resolveTokens?: (uids: string[]) => Promise<string[]>;
  removeTokens?: (tokens: string[]) => Promise<void>;
  touchTokens?: (tokens: string[]) => Promise<void>;
  timeBudgetMs?: number;
};

async function defaultResolveTokens(uids: string[]): Promise<string[]> {
  const db = adminDb();
  const tokens: string[] = [];
  for (const uidChunk of chunkTokens(uids, TOKEN_LOOKUP_CHUNK)) {
    const snap = await db.collection("push_tokens").where("uid", "in", uidChunk).get();
    for (const doc of snap.docs) {
      const token = (doc.data() as Record<string, unknown>)?.token;
      if (isValidExpoPushToken(token)) tokens.push(token);
    }
  }
  return [...new Set(tokens)];
}

async function defaultRemoveTokens(tokens: string[]): Promise<void> {
  const db = adminDb();
  await Promise.all(
    tokens.map((token) => db.collection("push_tokens").doc(sha256Hex(token)).delete())
  );
}

async function defaultTouchTokens(tokens: string[]): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  for (const token of tokens) {
    batch.set(
      db.collection("push_tokens").doc(sha256Hex(token)),
      { lastSuccessAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  await batch.commit();
}

async function postJson(
  fetchFn: typeof fetch,
  url: string,
  payload: unknown
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timeout);
  }
}

function asTicketArray(payload: unknown): ExpoTicket[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (t): t is ExpoTicket =>
      !!t && typeof t === "object" && ((t as ExpoTicket).status === "ok" || (t as ExpoTicket).status === "error")
  );
}

function asReceiptMap(payload: unknown): ExpoReceiptMap {
  const data = (payload as { data?: unknown })?.data;
  if (!data || typeof data !== "object") return {};
  return data as ExpoReceiptMap;
}

async function runPush(
  uids: string[],
  message: PushMessage,
  fetchFn: typeof fetch,
  resolveTokens: (uids: string[]) => Promise<string[]>,
  removeTokens: (tokens: string[]) => Promise<void>,
  touchTokens: (tokens: string[]) => Promise<void>
): Promise<PushResult> {
  const tokens = (await resolveTokens(uids)).filter(isValidExpoPushToken);
  if (tokens.length === 0) return { ...ZERO_RESULT };

  const tickets: Array<{ token: string; ticket: ExpoTicket }> = [];
  let sent = 0;
  let failed = 0;

  for (const tokenChunk of chunkTokens(tokens, PUSH_CHUNK_SIZE)) {
    const payload = await postJson(
      fetchFn,
      EXPO_SEND_URL,
      tokenChunk.map((token) => buildPayload(token, message))
    );
    const returned = asTicketArray(payload);
    tokenChunk.forEach((token, index) => {
      const ticket = returned[index];
      if (!ticket) {
        failed += 1;
        return;
      }
      tickets.push({ token, ticket });
      if (ticket.status === "ok") sent += 1;
      else failed += 1;
    });
  }

  const okTicketIds = tickets.filter((t) => t.ticket.status === "ok").map((t) => (t.ticket as { id: string }).id);
  let receipts: ExpoReceiptMap = {};
  for (const idChunk of chunkTokens(okTicketIds, RECEIPT_CHUNK_SIZE)) {
    const payload = await postJson(fetchFn, EXPO_RECEIPTS_URL, idChunk.map((id) => ({ id })));
    Object.assign(receipts, asReceiptMap(payload));
  }

  const dead = findDeadTokens(tickets, receipts);
  if (dead.length > 0) {
    // Best-effort prune; a datastore failure must not fail the request.
    await removeTokens(dead).catch(() => undefined);
  } else if (sent > 0) {
    // Best-effort freshness stamp so stale installs can be audited.
    const live = tickets.map((t) => t.token);
    await touchTokens(live).catch(() => undefined);
  }

  return { sent, failed, removed: dead.length };
}

function withBudget<T>(promise: Promise<T>, budgetMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), budgetMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function sendPushToUsers(
  uids: string[],
  message: PushMessage,
  deps: PushDeps = {}
): Promise<PushResult> {
  if (uids.length === 0) return { ...ZERO_RESULT };
  const fetchFn = deps.fetchFn ?? fetch;
  const resolveTokens = deps.resolveTokens ?? defaultResolveTokens;
  const removeTokens = deps.removeTokens ?? defaultRemoveTokens;
  const touchTokens = deps.touchTokens ?? defaultTouchTokens;
  const budget = deps.timeBudgetMs ?? PUSH_TIME_BUDGET_MS;
  try {
    return await withBudget(
      runPush(uids, message, fetchFn, resolveTokens, removeTokens, touchTokens),
      budget,
      { ...ZERO_RESULT }
    );
  } catch {
    return { ...ZERO_RESULT };
  }
}
