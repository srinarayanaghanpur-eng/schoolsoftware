/**
 * REMOVED (Phase 0 security cleanup, 2026-07-20).
 *
 * This legacy client-SDK payment writer duplicated POST /api/admin/payments
 * with weaker guarantees: non-transactional receipt numbering, no idempotency,
 * and payment documents missing schoolId/academicYearId. It was imported by
 * zero files (verified by audit — see docs/audit/04-backend-function-inventory.md).
 *
 * All payment writes MUST go through /api/admin/payments (server-side
 * transaction + idempotency + receipt counter). Delete this file entirely
 * once the repo can be pruned with a shell.
 */
export const paymentService = new Proxy({}, {
  get() {
    throw new Error("lib/paymentService.ts is removed. Use POST /api/admin/payments.");
  }
}) as Record<string, never>;

export default paymentService;
