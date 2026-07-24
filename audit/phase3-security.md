# ERP Audit — Phase 3: Authentication · Authorization · Security

**Scope:** Steps 7, 8, 15 — auth flows, per-role authorization, security assessment (OWASP-aligned).
**Method:** close reads of `apiUtils.ts` (all guard functions), `firestore.rules` (complete), `storage.rules` (complete), sensitive endpoints (cron, reset-app, receipts, biometric, login-id, password-reset), guard-coverage scan across all 190 API route files, secrets scan.

---

## 1. Authentication

### 1.1 Flow

Firebase Auth email/password with **synthetic internal emails** derived from employee/login IDs (`employeeIdToInternalEmail`). Client holds ID token; every API call sends `Authorization: Bearer <idToken>`, verified server-side via `verifyBearerToken` (firebase-admin). Sessions: token auto-refresh by Firebase SDK + `AutoLogoutProvider` (idle logout) + logout-redirect handling. Password reset is **admin-mediated**: unauthenticated users file a `password_reset_requests` doc; admins approve/reset — appropriate for a school where users have no real emails.

### 1.2 Findings

| # | Finding | Severity |
|---|---|---|
| AU1 | **`/api/login-id/check` is an unauthenticated, unrate-limited user-enumeration oracle** — returns exists:true/false for any loginId, querying teachers and users. Enables ID harvesting for credential stuffing. Add rate limiting + generic responses (or require a captcha-gated flow). | High |
| AU2 | `/api/password-reset-requests` (POST) is unauthenticated by design; dedup on open requests limits spam to one per loginId — decent. But no rate limit → bulk junk requests for unknown IDs (`targetType: "unknown"` still written). | Medium |
| AU3 | Role freshness: **API layer re-reads `users/{uid}` on every request** (`resolveRole`), so API access reflects role changes immediately — this neutralizes the ~1h stale-claim window for APIs. The window still exists for **direct Firestore access** (rules prefer claims). Deactivated teacher keeps `status=active` claim up to 1h → can still write mobile attendance. | Medium |
| AU4 | `resolveRole` **prefers the Firestore doc over the claim** while rules prefer the claim → API and rules can disagree for up to 1h after a role change. Document and accept, or force token revocation (`revokeRefreshTokens`) on role change. | Medium |
| AU5 | No MFA anywhere, including super_admin (who can wipe the app). Consider TOTP for back-office roles. | Medium |
| AU6 | Auto-logout + no-store cache headers on APIs — good hygiene. | ✅ |

## 2. Authorization

### 2.1 Server guard layer (`apiUtils.ts`) — strong

`requireAdmin` / `requireSuperAdmin` / `requireTeacher` / `requireRole` / `requirePermission` / `requireAll/AnyPermission`, all verifying the bearer token then resolving role from Firestore. Permission checks go through the shared RBAC matrix (7 roles, 26 modules, `${module}.${action}` strings, `*` wildcard, super_admin always allowed). `SELF_LOCK_PERMISSIONS` prevents locking yourself out. This is a well-designed, centralized authorization layer.

**Guard coverage: 177 of ~190 route files** import a guard or `verifyBearerToken`. The ~13 without guards are all *intentionally* public or secret-protected:
`login-id/check` (AU1), `password-reset-requests` (AU2), `academic-years/public`, `biometric/log` + `ingest` (shared-secret header), `admin/create-teacher`(⚠ verify — appears in neither guard list; if truly unguarded this is critical → **confirm before launch**).

### 2.2 Sensitive endpoints — verified

| Endpoint | Protection | Verdict |
|---|---|---|
| `admin/reset-app` | requireSuperAdmin + typed confirmation phrase "RESET APP DATA" | ✅ Strong |
| `cron/process-reminder-queue` | `x-cron-secret` == `CRON_SECRET` env OR admin token | ✅ (ensure CRON_SECRET set in prod; empty-secret path falls back to requireAdmin) |
| `api/receipts/[id]` | Authenticated; fees.view for staff, or parent restricted to **linked students only** | ✅ Exemplary ownership check — R1 from Phase 2 is resolved: public receipt *pages* are backed by an authenticated API |
| `biometric/log` | `x-biometric-secret` vs value in settings doc | ⚠ See S1 below — the secret itself is readable by all signed-in users |
| `admin/restore-data`, `erase-data`, `students/bulk-delete` | Guard imports present | Verify guard is on **every method** in Phase 4 |

### 2.3 Role → access matrix (effective)

| Role | Pages | API | Firestore direct |
|---|---|---|---|
| super_admin | all | all (wildcard) | isAdmin() everywhere |
| admin | all except /admin/settings (settings_manager area) | `*` permissions | isAdmin() |
| principal | back-office (read-heavy) | per-matrix (view/approve concessions) | concessions/payments/receipts read |
| accountant | /admin incl. finance, fee-reminders | fees/finance permissions | finance collections read/write |
| settings_manager | /admin, /admin/settings | requireAdmin includes it (⚠ broader than name implies — it passes `requireAdmin`, so it can hit any endpoint guarded only by requireAdmin, including finance ones if they use requireAdmin rather than requirePermission) | isAdmin()? No — rules isAdmin() excludes settings_manager → asymmetry |
| teacher | /teacher | teacher endpoints | own profile, own attendance (create from mobile only), leave/password requests |
| parent | /portal | portal endpoints (link-scoped) | effectively nothing (see S2) |

**AZ1 (High):** `requireAdmin` accepts `settings_manager` — a "settings" role passes the generic admin guard used by many routes (certificates, timetable, sync, etc. import requireAdmin). Verify intent; least-privilege suggests settings_manager should not pass a guard named requireAdmin.
**AZ2 (Medium):** rules' `isAdmin()` = admin|super_admin only → principal/settings_manager have API powers but no client-SDK powers; harmless today (API-first) but confusing.

## 3. Firestore rules — findings

| # | Finding | Severity |
|---|---|---|
| S1 | **Secrets readable by every signed-in user.** `settings/*` and `fee_reminder_settings/*` allow `read: if signedIn()`. The biometric API secret (`settings.biometricApiSecret`) and WhatsApp/SMS provider API keys (`settings.whatsappApiKey`, `settings.smsApiKey`, read by the cron processor) live in these docs. **Any teacher or parent can read the biometric ingest secret and the messaging API keys** with the client SDK. Move secrets to env vars or a locked collection (`allow read: if false`, server-only). | **Critical** |
| S2 | **`isParentOfStudent()` is broken**: it calls `get()` on a collection path and inverts an `exists()` on the wrong path — it can never authorize correctly (fails closed). Parents can't read `students/*` directly; portal works only because it's API-mediated. Dead/broken rule — delete or fix. | Medium (correctness) |
| S3 | Broad `read: if signedIn()` on exams, exam_marks, notices, fee_structures, timetable, transport, library, hostel, inventory, settings, holidays, roles, approval_requests → **a parent with the client SDK can enumerate every student's exam marks, all transport assignments, all library issues** etc. API layer scopes responses, but the rules don't. For 50k users this is a real data-exposure surface (PII + grades). Tighten per collection. | **High** |
| S4 | `parent_messages` create: `if signedIn()` with no schema check → any user can create messages impersonating any parentUid. | Medium |
| S5 | `homework_submissions` create: `if signedIn()` — same issue (any user, any studentId). | Medium |
| S6 | `counters`/`receipt_counters` client-writable by finance roles → receipt-number integrity depends on all writers using transactions; a buggy/malicious accountant client could corrupt numbering. Prefer server-only. | Low |
| S7 | Legacy fallback `userDoc()` in role functions costs a read and re-opens the stale-claims mitigation — acceptable, documented. | Info |
| S8 | Final `match /{document=**} { allow: false }` default-deny — ✅ correct. |
| S9 | Attendance mobile-create constraints (`source=="mobile"`, `adminEdited==false`, own teacherId) — ✅ thoughtful. |

## 4. Storage rules — findings

| # | Finding | Severity |
|---|---|---|
| ST1 | Only two path matches exist (`teacher-profiles`, `attendance-selfies`). `uploadService` builds **student photo and document paths that match no rule → default deny**. Either student uploads are broken, or they bypass Storage (verify). | High (functional) |
| ST2 | `isAdmin()` here checks `role == "admin"` **only** — super_admin cannot write teacher profiles; claims-only (no legacy fallback) unlike Firestore rules. Inconsistent. | Medium |
| ST3 | No file-size or content-type constraints on selfie/profile writes → unbounded uploads (cost abuse, malware hosting). | Medium |

## 5. General security assessment (OWASP-aligned)

- **Injection/XSS:** React escaping by default; no `dangerouslySetInnerHTML` hits in scanned files; `react-markdown` renders AI output (safe by default, doesn't render raw HTML). Firestore is NoSQL — injection surface minimal; zod parsing on inputs (spot-checked; full validation coverage in Phase 4). ✅
- **CSRF:** APIs are bearer-token (no cookies) → CSRF essentially inapplicable. ✅
- **Secrets in repo:** scan for Google API keys / private keys / sk- tokens found **nothing hardcoded**. AI (Gemini) key is stored encrypted (`lib/ai/encryption`) — but verify the encryption key source and that the settings doc holding it isn't `signedIn()`-readable (relates to S1). ⚠
- **Rate limiting:** exists only in the AI quota layer. Nothing on auth-adjacent public endpoints (AU1/AU2) or general APIs. For 50k users, add per-IP limits at the edge (Vercel/Cloudflare) at minimum. **High**
- **Audit logging:** `auditLog.ts`, `admin_audit_logs`, `attendance_edit_audit_logs` (delete: never — nice), `backup_audit_logs`, `feeAuditLogs` — unusually good. Verify money-mutating APIs all write audit entries (Phase 4). ✅
- **Broken access control:** the dominant residual risk is the **rules layer (S1, S3)** — the API layer is solid, but any signed-in user with the Firebase client SDK bypasses the API entirely for `signedIn()`-readable collections.

## 6. Scores

| Area | Score | Basis |
|---|---|---|
| Authentication | 7/10 | Solid token flow, admin-mediated resets; − enumeration oracle, no MFA, no rate limits |
| Authorization (API) | 8.5/10 | Centralized guards, permission matrix, ownership checks on receipts; − settings_manager in requireAdmin, create-teacher to verify |
| Firestore rules | **4/10** | Secrets readable by all users (S1), broad signedIn() reads (S3), broken parent rule |
| Storage rules | 4/10 | Unmatched upload paths, role inconsistency, no constraints |
| Overall security posture | 6/10 | Strong server layer undermined by permissive rules |

## 7. Priority fixes from this phase

1. **S1 (Critical):** lock `settings`/`fee_reminder_settings` reads to admin (or split public display settings from secret-bearing docs); rotate the biometric secret and WhatsApp/SMS keys after locking.
2. **S3 (High):** replace blanket `signedIn()` reads with role-scoped reads (esp. exam_marks, transport_assignments, students-adjacent data).
3. **AU1 (High):** rate-limit + de-oracle `login-id/check`.
4. **AZ1 (High):** remove `settings_manager` from `requireAdmin` or rename/split the guard; audit every route that uses bare `requireAdmin` for finance data.
5. **ST1–ST3 (High/Med):** add student-upload path rules with size/type constraints; fix super_admin in storage `isAdmin()`.
6. Verify `admin/create-teacher` guard, and add MFA for super_admin.

**Next: Phase 4 — Backend & API audit** (per-endpoint validation coverage, transactions/race conditions in fees/payments/payroll, error handling, the create-teacher question, destructive-endpoint method-level guards).
