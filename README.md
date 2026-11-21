# NarayanaOS — School ERP

NarayanaOS is a multi-platform school management system for Sri Narayana High School. It brings administration, academics, attendance, fees, payroll, communication, and school operations into one Firebase-backed application.

The repository contains a Next.js web application, an Expo/React Native mobile app, an Electron desktop app for Windows, and a shared TypeScript package.

## Platforms

### Web ERP

The Next.js application is the main administrative interface for school staff.

- Role-based admin, accountant, teacher, parent, and student experiences
- Student admission, profiles, classes, sections, academic years, and promotions
- Staff and teacher management
- Daily attendance, leave requests, holidays, biometric records, and reports
- Fee structures, invoices, collections, concessions, dues, reminders, receipts, and vouchers
- Accounting, expenses, vendors, banking, ledger, and financial reports
- Salary and payroll generation with advances and deductions
- Exams, marks, report cards, homework, timetable, and certificates
- Transport, library, hostel, and inventory management
- Notices, notifications, messages, AI assistance, approvals, and audit logs
- Firebase authentication, Firestore data, storage, and server-side API routes

### Mobile app

The Expo application provides focused workflows for teachers and parents.

- Teacher and accountant sign-in
- Attendance and attendance history
- GPS-assisted attendance with configurable school geofencing
- Calendar, reports, marks, salary, notices, and profile screens
- Parent and principal portal screens
- Fee, payment, transport, and homework views
- Expo push notification and background task support
- Firebase data access and web API integration

### Windows desktop app

The Electron package wraps the web ERP for Windows.

- NSIS installer and portable build support
- Packaged Next.js standalone server
- WhatsApp/Baileys messaging agent
- Runtime environment configuration stored outside the installer

## Technology

| Area | Technology |
| --- | --- |
| Web | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Mobile | Expo, React Native, Expo Router |
| Desktop | Electron 33, electron-builder |
| Backend | Firebase Authentication, Firestore, Firebase Storage |
| Admin/server | Firebase Admin SDK, Next.js API routes |
| Shared logic | TypeScript, Zod |
| Reports | XLSX, Recharts, `docx`, QR generation |
| Testing | Playwright, Axe, Node test runner |

## Repository structure

```text
apps/
  web/      Next.js web ERP
  mobile/   Expo teacher and parent applications
  desktop/  Electron packaging and messaging agent
packages/
  shared/   Shared types, schemas, services, and seed utilities
scripts/    Build, seed, test, and operational tooling
docs/       Schema, API, implementation, and operations documentation
tests/      Playwright and quality tests
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Firebase project
- Firebase CLI for emulator and deployment workflows
- Expo CLI tooling for mobile development
- Windows and Electron tooling for desktop installers

## Installation

Install all npm workspaces:

```bash
npm install
```

For environments that require legacy dependency resolution:

```bash
npm install --legacy-peer-deps
```

## Firebase configuration

Start by creating a Firebase project and enabling:

- Email/password authentication
- Cloud Firestore
- Firebase Storage

Copy the example web environment file:

```bash
cp env.example apps/web/.env.local
```

Fill in the Firebase web configuration and, where needed, Firebase Admin credentials.

For server-side Firebase access, provide either a complete service-account JSON string:

```text
FIREBASE_SERVICE_ACCOUNT_KEY={"project_id":"...","client_email":"...","private_key":"..."}
```

or the individual fields:

```text
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Deploy or review the configured rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The repository includes `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.

## Running the web app

```bash
npm run dev:web
```

Open `http://localhost:3000`.

## Running the mobile app

Copy the mobile environment template:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Set the Firebase variables and use the reachable web API URL:

```text
EXPO_PUBLIC_WEB_API_URL=http://192.168.1.11:3000
EXPO_PUBLIC_SITE_URL=http://localhost:3000
```

On a physical device, `localhost` refers to the device itself. Use the computer's LAN IP address so the phone can reach the web API.

Start Expo:

```bash
npm run dev:mobile
```

## Local Firebase emulators

The web environment can be switched to local Firebase emulators.

Add the following to `apps/web/.env.local`:

```text
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

Start the emulators:

```bash
npm run test:emulator:start
```

Then open `http://localhost:4000` for the emulator UI.

Stop the emulators with:

```bash
npm run test:emulator:stop
```

Do not enable emulator mode in production.

## Running the desktop app

Development:

```bash
npm run dev:desktop
```

Create a Windows NSIS installer:

```bash
npm run dist:desktop
```

Create a portable build:

```bash
npm run dist:portable
```

Quickly reuse an existing web build:

```bash
npm run dist:desktop:quick
```

Desktop installers are written to `apps/desktop/dist`.

## Builds and tests

```bash
npm run build:web
npm run typecheck:web
npm test
npm run test:hydration
npm run test:e2e
```

To start emulators and run the full Playwright suite:

```bash
npm run test:qa-full
```

## Demo data

Generate demo Firestore-ready JSON:

```bash
npm run seed
```

The shared seed utility prints sample data to the terminal. Review and import it with appropriate school data and identifiers; do not treat it as a production migration.

## Initial admin setup

Create the first account in Firebase Authentication, then assign the admin role with Firebase Admin:

```ts
await admin.auth().setCustomUserClaims(uid, {
  role: "admin",
  school_id: "default-school",
});
```

Create the corresponding user document, for example:

```json
{
  "uid": "admin_uid",
  "role": "admin",
  "email": "admin@example.com",
  "displayName": "Admin",
  "status": "active"
}
```

Keep Firebase custom claims, user documents, and school/branch scoping aligned with the rules in `apps/web/lib` and `firestore.rules`.

## Attendance and GPS

Campus geofencing is configured in `settings/school` and managed from the web settings area.

The mobile app reads the configured latitude, longitude, radius, school start time, grace period, and timezone. GPS is checked by the client and revalidated by the server before attendance is written.

The attendance GPS/time enforcement is enabled by default. It can only be temporarily bypassed with the explicit environment flags documented in `env.example`.

## Biometric integration

The biometric webhook accepts device logs and merges them into the attendance records:

```text
POST /api/biometric/ingest
Header: x-biometric-secret: <secret>
```

Configure `BIOMETRIC_API_SECRET` and the matching secret in the school settings. The raw event is stored before it is correlated with staff or teacher records.

## Backups and scheduled jobs

The web app includes:

- JSON backup and restore workflows
- Backup audit logs and guarded data erase
- Google Drive backups for selected Firestore collections
- Scheduled reminder and backup API routes

Vercel cron configuration is available in `vercel.json`. Google Drive OAuth fields and cron secrets are described in `env.example`.

## Deployment

### Vercel

The included `vercel.json` configures:

- Next.js build through `npm run build:vercel`
- Security response headers
- Scheduled Google Drive collection backups

Configure all required Firebase, Admin, OAuth, cron, and public URL variables in the Vercel project before deployment.

### Firebase rules

Deploy Firestore and Storage rules after authentication and role claims are configured:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Desktop packaging

Desktop builds should receive runtime configuration through the per-user app-data environment mechanism implemented by `apps/desktop/main.js`. Secret environment files are deliberately excluded from packaged installers.

## Security

- Never commit `.env`, `.env.local`, service-account files, private keys, or access tokens.
- Keep Firebase credentials and all `FIREBASE_*` values server-side.
- Only expose public configuration through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.
- Review Firestore and Storage rules before production use.
- Restrict biometric webhooks and cron routes with strong secrets.
- Use HTTPS and authorized domains for production authentication and reset links.

## Documentation

Additional guides are available in [`docs/`](./docs) and [`USER_GUIDE.md`](./USER_GUIDE.md).
