/**
 * Thin client over the ERP admin API. The agent NEVER talks to Firestore
 * directly — it reuses the authenticated, permission-checked ERP endpoints so
 * all reads/writes stay inside the app's security model.
 */
import { config } from './config.js';
import { logger } from './logger.js';
import type { QueueItem, AgentSettings, SendResult } from './types.js';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.erpBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.erpAdminToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, error: text };
  }
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    const err = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(`ERP ${path} failed: ${err}`);
  }
  return body as T;
}

/** Pull every queue item the admin approved for sending. Paginates fully. */
export async function fetchApprovedQueue(
  status: QueueItem['status'] = 'approved',
): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  let cursor = '';
  do {
    const qs = new URLSearchParams({ status, pageSize: '100' });
    if (cursor) qs.set('cursor', cursor);
    if (config.schoolId) qs.set('schoolId', config.schoolId);
    const page = await api<{ items: QueueItem[]; nextCursor: string | null }>(
      `/api/admin/fee-reminder-queue?${qs.toString()}`,
    );
    items.push(...page.items);
    cursor = page.nextCursor ?? '';
  } while (cursor);
  logger.info(`Fetched ${items.length} '${status}' queue item(s) from ERP.`);
  return items;
}

/** Load merged reminder settings and map them to the agent's runtime shape. */
export async function fetchSettings(): Promise<AgentSettings> {
  const { settings } = await api<{ settings: Record<string, unknown> }>(
    '/api/admin/fee-reminder-settings',
  );
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const mode = settings.sendMode;
  const sendMode: AgentSettings['sendMode'] =
    mode === 'prepare_only' || mode === 'automatic' || mode === 'review_each'
      ? mode
      : config.defaultSendMode;
  return {
    sendMode,
    dailyLimitEnabled: b(settings.dailyLimitEnabled, true),
    dailyLimit: n(settings.dailyLimit, 300),
    alreadySentToday: n(settings.alreadySentToday, 0),
    delayMinMs: n(settings.delayMinMs, config.delayMinMs),
    delayMaxMs: n(settings.delayMaxMs, config.delayMaxMs),
    pauseAfterEvery: n(settings.pauseAfterEvery, 50),
    pauseDurationMs: n(settings.pauseDurationSeconds, 60) * 1000,
    retryFailed: b(settings.retryEnabled, true),
    maxRetryCount: n(settings.retryCount, 3),
    skipAlreadySent: b(settings.skipAlreadySent, true),
    messageTemplate: String(settings.messageTemplate ?? ''),
    schoolName: String(settings.schoolName ?? ''),
    supportPhone: String(settings.supportPhone ?? ''),
  };
}

/** Update the status of a single queue item. */
export async function updateItemStatus(
  id: string,
  status: QueueItem['status'],
  reason?: string,
): Promise<void> {
  await api('/api/admin/fee-reminder-queue', {
    method: 'PUT',
    body: JSON.stringify({ ids: [id], status, reason: reason ?? '' }),
  });
}

/** Write a delivery log row (searchable history in the ERP). */
export async function logResult(result: SendResult, item: QueueItem): Promise<void> {
  try {
    await api('/api/admin/fee-reminder-logs', {
      method: 'POST',
      body: JSON.stringify({
        queueId: result.id,
        studentId: item.studentId ?? '',
        studentName: item.studentName ?? '',
        parentNumber: result.phone,
        message: result.message,
        channel: 'google_messages_web',
        status: result.status,
        error: result.error ?? '',
        retryCount: result.retryCount,
        sentAt: result.at,
      }),
    });
  } catch (e) {
    // Logging must never break the queue — warn and continue.
    logger.warn(`Failed to write log for ${result.id}: ${(e as Error).message}`);
  }
}
