# Production Pass 2 — Verification & Hardening (6 July 2026)

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` (apps/web) | **BLOCKED** — sandbox VM cannot start: "Not enough disk space to set up the workspace". Free disk space on this PC, then run `npm run typecheck` in `apps/web`. |
| lint / build | Same blocker. All changed files were manually verified (imports, types, transaction read-before-write rules). |

## Files changed this pass

| File | Change |
|---|---|
| `apps/web/lib/adminApiClient.ts` | **Cache safety hardening**: cache keys now scoped per signed-in uid (no cross-account leaks on shared devices); `clearAdminApiCacheForSignOut()` wipes everything on logout; stale fallback confirmed GET-only and only for status 0/429/5xx — 401/403 always propagate (auth errors never masked by old private data); mutations still never cached and invalidate all GETs on success; new `API_STATUS_EVENT` emitted on ok / stale-served / request-failed. |
| `apps/web/components/AppShell.tsx` | Sign-out now calls `clearAdminApiCacheForSignOut()`. OfflineBanner upgraded to 4-state UX: **Offline** (amber) / **Back online — refreshing** (blue, brief) / **Connection problem — showing saved data** + Retry (slate) / **Request failed** + Retry (red). Retry button has ≥28px touch target. |
| `apps/web/app/api/admin/payments/route.ts` | **Idempotency implemented**: optional `idempotencyKey` in POST body; stored as doc id in `payment_idempotency/{key}` written inside the existing transaction (reads first, then writes). Re-submitting the same key returns the original payment with `duplicate: true` (HTTP 200) — no second payment, receipt, counter increment, or fee-total change. |
| `apps/web/app/api/fees/confirm/route.ts` | The live fee-collection flow (order → confirm): re-confirming an already-paid order now returns the original `receiptId`/`receiptNumber` with `duplicate: true` instead of throwing "Order already paid". Order doc now records `paymentId` + `receiptNumber`. Natural idempotency key = orderId. |
| `apps/web/app/admin/salary/page.tsx` | `xlsx` (~400KB) removed from page-load bundle; dynamically imported inside `exportToExcel()` only when the user clicks Export. |
| `apps/web/public/sw.js` | `syncPaymentData()` **disabled as a safety no-op** — it targeted a non-existent `/api/admin/payments/batch` endpoint with no auth and no idempotency key. Attendance sync untouched. |

## Cache correctness — verified point by point

- Stale after mutation? No — any non-GET invalidates all cached GETs for the user before returning.
- Stale fallback scope? GET only; only network-down (0), quota (429), 5xx. 4xx auth/client errors propagate untouched.
- 401/403 old data? Impossible via fallback path; plus per-uid keys and sign-out wipe mean another account can't read them either.
- Key scoping? `snapi:{uid}|{path}` in localStorage; memory cache keyed identically.

## Idempotency status: **fully implemented, not yet exercised by an offline queue**

- Admin direct POST: `payment_idempotency/{key}` transactional guard — done.
- Live UI flow (order/confirm): orderId-based guard returning the original receipt — done.
- Duplicate receipt numbers: impossible; receipt counter only increments in the non-duplicate branch of the transaction.
- Offline payment queue: **still intentionally OFF** (sw.js payment sync disabled). To enable later: queue records must carry `idempotencyKey` + auth token, and a `/api/admin/payments/batch` endpoint must reuse the same `payment_idempotency` guard.

## Virtualization — deliberately skipped, with reason

Students, payments, and attendance lists are already cursor-paginated at 25–100 rows per page; virtualization gives no benefit below ~200 rendered rows. `@tanstack/react-virtual` is also not installed and `npm install` is blocked by the disk-space issue. Revisit only if you later render unpaginated lists.

## Bundle size

- Salary page: −~400KB parsed JS at page load (xlsx now on-demand). Not measurable precisely without a build (blocked by disk space).
- `ExportButtons.tsx` already used dynamic xlsx import (no change needed).
- recharts left as static imports: it's embedded across the finance page JSX and Next already code-splits per page; converting to `next/dynamic` is possible but riskier than the win. Optional future task.

## Offline behavior status

- Reads: Firestore IndexedDB persistence + API localStorage fallback → cached data instead of blank screens. ✅
- Status UX: online / offline / reconnecting / failed-with-retry banner, app-wide. ✅
- Writes: fail fast when offline. Attendance SW queue exists (pre-existing); payment queue disabled. No duplicate finance entries possible from sync, because payment sync cannot run. ✅

## Estimated Firebase reads (unchanged from pass 1, still valid)

Repeat navigation within 30s = 0 reads; dashboard repeat visits within 60s = 0 reads; duplicate payment submission now also = ~2 reads (idempotency lookup) instead of a full write cascade.

## Manual test checklist before deploy

1. `npm run typecheck` + `npm run build` in `apps/web` (after freeing disk space) — must pass.
2. Login/logout on one device with two different accounts → second account must never see first account's lists (localStorage keys `snapi:` should be empty after sign-out).
3. Collect a fee, then click Confirm twice fast / retry after DevTools-offline → exactly one payment and one receipt number; second response has `duplicate: true`.
4. POST the same `idempotencyKey` twice to `/api/admin/payments` (e.g. via REST client) → one payment doc, second response `duplicate: true`.
5. DevTools → Offline: banner turns amber; navigate pages — cached data appears; back online — blue "refreshing" banner, then clears.
6. Kill the API (or 500 it): red "Request failed — Retry" banner appears; Retry reloads.
7. Salary page: Network tab — no `xlsx` chunk on page load; chunk loads on first Export click; exported file opens correctly.
8. Mutations refresh lists: add a student → students list shows it immediately (cache invalidated).

## Remaining known items (not blocking deploy)

- recharts dynamic-import refactor (optional bundle win on finance/portal pages).
- Offline write queue for attendance already exists in sw.js — review its endpoint (`/api/admin/attendance/batch` also doesn't exist; it's currently a no-op loop).
- Old-format `snapi:` localStorage entries from pass 1 are orphaned until sign-out wipes them (harmless).
