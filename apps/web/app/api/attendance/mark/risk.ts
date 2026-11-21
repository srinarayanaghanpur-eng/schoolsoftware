/**
 * Pure anti-fraud decisions for the attendance endpoint.
 * Kept dependency-free so they run under plain node:test.
 */

export const ACCURACY_REVIEW_THRESHOLD_METERS = 100;

/** Non-admin attendance from a mocked OS location is rejected outright. */
export function shouldRejectMockLocation(isAdmin: boolean, isMockLocation?: boolean): boolean {
  return !isAdmin && isMockLocation === true;
}

/** Poor GPS accuracy is a review flag, never a block. */
export function shouldFlagAccuracy(accuracyMeters?: number): boolean {
  return (
    typeof accuracyMeters === "number" &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > ACCURACY_REVIEW_THRESHOLD_METERS
  );
}
