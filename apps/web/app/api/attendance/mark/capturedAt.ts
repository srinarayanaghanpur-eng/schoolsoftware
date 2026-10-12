/**
 * capturedAt validation for offline-synced attendance (Phase 5).
 *
 * The client records the moment of the attempt; the server accepts it only
 * inside a tight window around server time so a stale or fabricated capture
 * cannot weaken the GPS / time-window anti-fraud checks. Pure — unit-tested
 * below in capturedAt.test.ts, including boundary cases.
 */

/** Captures up to 2 minutes in the future are tolerated (clock skew). */
export const CAPTURED_AT_FUTURE_TOLERANCE_MS = 2 * 60 * 1000;
/** Captures older than 120 minutes must be re-marked fresh. */
export const CAPTURED_AT_MAX_AGE_MS = 120 * 60 * 1000;

export type CapturedAtCheck = { ok: true } | { ok: false; error: string };

export function validateCapturedAt(capturedAt: string | undefined, serverNowMs: number): CapturedAtCheck {
  if (!capturedAt) return { ok: true };
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) {
    return { ok: false, error: "Recorded time is not a valid timestamp." };
  }
  if (capturedMs > serverNowMs + CAPTURED_AT_FUTURE_TOLERANCE_MS) {
    return { ok: false, error: "Recorded time is in the future. Please mark attendance again." };
  }
  if (capturedMs < serverNowMs - CAPTURED_AT_MAX_AGE_MS) {
    return {
      ok: false,
      error: "This attempt is older than 2 hours and can no longer be synced. Please mark attendance again."
    };
  }
  return { ok: true };
}
