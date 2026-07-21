/**
 * REMOVED (Phase 0 security cleanup, 2026-07-20).
 *
 * Legacy client-SDK CRUD over fee_structures / students / concessions /
 * payments that bypassed API validation and summary recalculation. Imported by
 * zero files (verified by audit — docs/audit/04-backend-function-inventory.md).
 * Use the server APIs instead:
 *   /api/admin/fee-structures, /api/admin/concessions, /api/admin/payments.
 */
export const feeService = new Proxy({}, {
  get() {
    throw new Error("lib/feeService.ts is removed. Use the /api/admin/* fee endpoints.");
  }
}) as Record<string, never>;

export default feeService;
