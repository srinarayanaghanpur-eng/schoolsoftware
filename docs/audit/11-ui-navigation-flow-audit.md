# 11 — UI & Navigation Flow Audit

Shell: `components/AppShell.tsx` + `OptimizedAppLayout.tsx`; RBAC-filtered sidebar; shared primitives are good (`ResponsiveTable`, `PaginationControls`, `FilterSheet`, `StatusBadge`, `FinanceShell/FinanceTabs/FinanceSubnav`, `ActionMenu`, `PageHeader`, loading/empty states via `AppLoader`/`FinanceEmptyState`, `ErrorBoundary`, dark mode). Mobile-conscious components exist throughout.

## Issues found (code-level)

1. **Duplicate menus/pages**: `/admin/academic-years` AND `/admin/settings/academic-years`; `/admin/finance/reminders` AND `/admin/fee-reminders` (two reminder UIs over overlapping APIs); `notifications` vs `admin_notifications` surfaces.
2. **Finance sprawl**: 25+ finance pages as flat routes. Cash-book, ledger, statements, trial-balance, P&L, daily closing — a working accountant needs a consolidated daily flow (open day → collect → expenses → close day) rather than 25 destinations.
3. **Fee collection navigation**: collection lives at `/admin/payments`, student profile at `/admin/students`. No verified global student search → profile → collect shortcut. Recommended: Dashboard → global search → student profile → Fees tab → Collect → Receipt.
4. **Buttons leading nowhere / dead surfaces**: parent portal Attendance page (permanently empty — worse than absent, it looks broken to parents); audit logs written but no viewer.
5. **Confirmation/feedback**: destructive endpoints exist (bulk-delete, erase-data, reset-app). `BackupErasePanel` exists; confirm double-confirmation UX before production.
6. **Pagination**: payments list uses cursor pagination ✅; several pages read Firestore directly client-side (dashboard, biometric) — verify limits to avoid unbounded reads.
7. **Teacher UX**: dashboard is polished (metrics, calendar, GPS panel) but has no academic destinations — teachers will judge the ERP unusable for classroom work.
8. **Stale data risk**: `dashboardSummaries` + dirty-flag `sync` pattern means dashboard numbers can lag until rebuild; there is a manual rebuild API — surface "last updated" prominently.

## Per-module current → recommended (examples)

- **Fees**: Current: Students → find student → note dues → Payments → re-enter student → collect. Recommended: student row → "Collect fee" inline action opening the payment form pre-filled.
- **Attendance (staff)**: current flow is fine (single page, date + teacher grid).
- **Reminders**: unify `/admin/fee-reminders/*` and `/admin/finance/reminders` into one module with Settings / Queue / History tabs.
- **Reports**: 7 report APIs are spread between `/admin/reports` and `/admin/fee-reports`; merge into one reports hub with tabs.
