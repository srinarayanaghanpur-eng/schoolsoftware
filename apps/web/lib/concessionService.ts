/**
 * REMOVED (Phase 0 security cleanup, 2026-07-20).
 *
 * Legacy client-SDK concession CRUD duplicating /api/admin/concessions without
 * server-side validation or fee-summary recalculation. Imported by zero files
 * (verified by audit — docs/audit/04-backend-function-inventory.md).
 * Use /api/admin/concessions instead.
 */
export const concessionService = new Proxy({}, {
  get() {
    throw new Error("lib/concessionService.ts is removed. Use /api/admin/concessions.");
  }
}) as Record<string, never>;

export default concessionService;
