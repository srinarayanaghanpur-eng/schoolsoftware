# 13 — Mock, Placeholder and Disconnected Code

Repo-wide grep results (`apps/web`): the app is notably clean of mock data. No `mockData`/`dummyData`/`sampleData` arrays, no "Coming Soon"/"not implemented" strings in `app/` (verified by grep). The 48 files matching mock/placeholder keywords are overwhelmingly HTML input `placeholder=` attributes (e.g. `admin/timetable/page.tsx` lines 161–228) — not fake data.

| File / area | Type | Effect | Production replacement |
|---|---|---|---|
| `lib/paymentService.ts` | Dead duplicate code (client-SDK payment writes) | none (unimported) — but a trap for future devs | Delete; keep only `/api/admin/payments` |
| `lib/feeService.ts` | Dead client CRUD for fee_structures/students/concessions | none (unimported by pages) | Delete after final reference check |
| `lib/concessionService.ts` | Likely-duplicate client CRUD | possible bypass of API validation if imported | Confirm imports; delete or migrate |
| `app/api/portal/attendance/route.ts` + `app/portal/attendance/page.tsx` | Disconnected feature (reads never-written `student_attendance`) | parents see a permanently empty attendance screen | Build student-attendance marking module, or hide page until built |
| `/api/cron/*` reminder endpoints | Backend without trigger | reminders never run | Add scheduler (Cloud Scheduler/Vercel cron) + secret |
| `lib/reminder/{whatsappProvider,smsProvider}.ts` | External-provider stubs/config-dependent | sends fail without credentials | Provision provider accounts; add env config |
| `console.log` usage | Debug logging widespread incl. API routes (`console.error` mostly, some `[PERF]` logs) | log noise; minor PII risk | Introduce leveled logger; scrub PII |
| `audit_logs`/`feeAuditLogs` etc. | Write-only collections | unauditable in practice | Add admin log-viewer UI |
| `apps/mobile`, `apps/desktop` | Unaudited siblings | unknown drift vs web | Audit separately before shipping |

Searches still to run exhaustively across `components/` and `packages/`: `localStorage` misuse, `Math.random` IDs, `setTimeout` fake loading (initial pass found none in `app/`).
