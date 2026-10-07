/**
 * Offline queue for teacher self-attendance (Phase 5).
 *
 * This module is deliberately dependency-free (no react-native, no storage
 * imports) so it runs under plain node:test. Persistence is injected by the
 * caller — see useAttendanceMarking for the AsyncStorage adapter.
 *
 * Anti-fraud rule: only NETWORK failures (and retryable 5xx/429) are queued.
 * 4xx validation errors are definitive — the server rejected the attempt, so
 * queuing it would only replay a doomed request.
 */

export type QueueAction = "checkin" | "checkout";

export type QueuedAttempt = {
  clientRequestId: string;
  action: QueueAction;
  /** ISO timestamp captured at the moment of the attempt (server validates it). */
  capturedAt: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  /** Full POST body minus volatile keys (clientRequestId/capturedAt added at sync). */
  payload: Record<string, unknown>;
};

/** Max queued attempts; oldest-first eviction keeps the store bounded. */
export const OFFLINE_QUEUE_CAP = 20;

/** RFC 4122 v4 uuid without any dependency. */
export function newUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Keep only the newest `cap` attempts (FIFO eviction of the oldest). */
export function capQueue(queue: QueuedAttempt[], cap: number = OFFLINE_QUEUE_CAP): QueuedAttempt[] {
  if (queue.length <= cap) return queue;
  return queue.slice(queue.length - cap);
}

export type FailureClass = "network" | "retryable-status" | "definitive";

/**
 * Classify a submit failure by HTTP status. `undefined` means the request
 * never got a response (offline, DNS, timeout, aborted).
 */
export function classifySubmitFailure(status?: number): FailureClass {
  if (status === undefined) return "network";
  if (status === 429 || status >= 500) return "retryable-status";
  return "definitive";
}

/** Merge a queued attempt into the POST body the server expects. */
export function buildQueuedPayload(attempt: QueuedAttempt): Record<string, unknown> {
  return {
    ...attempt.payload,
    clientRequestId: attempt.clientRequestId,
    capturedAt: attempt.capturedAt
  };
}
