# Sri Narayana Staff Attendance System

Full-stack school staff attendance ERP with a Next.js admin web app, Expo teacher mobile app, Firebase backend, ESSL biometric ingestion structure, salary calculation, calendar views, and Excel reports.

## Apps

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS, Recharts, Firebase Auth, Firestore, xlsx
- `apps/mobile`: Expo React Native, TypeScript, Firebase Auth, Firestore, Expo Location, Expo Device, optional Camera
- `packages/shared`: shared types, schema validation, attendance logic, salary logic, biometric processing, report builders, demo data

## Install

```bash
npm install
```

## Configure Firebase

1. Create a Firebase project.
2. Enable Email/Password Auth.
3. Create Firestore and Storage.
4. Copy `.env.example` into `apps/web/.env.local`.
5. Copy the Expo variables into `apps/mobile/.env`.
6. Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.

For server API routes, configure either:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"project_id":"...","client_email":"...","private_key":"..."}'
```

or:

```bash
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Run Web

```bash
npm run dev:web
```

Open `http://localhost:3000`.

## Run Mobile

```bash
npm run dev:mobile
```

Set `EXPO_PUBLIC_WEB_API_URL` to the reachable web API URL. On a physical phone, `localhost` means the phone itself, so use your computer LAN IP.

## Set Admin Account

Create the first admin user in Firebase Auth, then set a custom claim using Firebase Admin SDK:

```ts
await admin.auth().setCustomUserClaims(uid, { role: "admin" });
```

Also create `users/{uid}`:

```json
{
  "uid": "admin_uid",
  "role": "admin",
  "email": "admin@example.com",
  "displayName": "Admin",
  "createdAt": "2026-05-19T00:00:00.000Z",
  "updatedAt": "2026-05-19T00:00:00.000Z"
}
```

## Campus GPS

Settings live in `settings/school`:

```json
{
  "campusLatitude": 18.30639479001936,
  "campusLongitude": 79.88312064907495,
  "geofenceRadiusMeters": 150,
  "schoolStartTime": "09:00",
  "graceMinutes": 10,
  "timezone": "Asia/Kolkata"
}
```

Mobile attendance checks distance before sending attendance. The backend checks again before writing.

Admin GPS setup is available at:

```text
/admin/settings
```

Use `Use current GPS` while standing at the school campus center, or manually enter latitude and longitude. The teacher mobile app reads `settings/school`, shows the school GPS, shows the teacher's current GPS, calculates distance, and blocks attendance outside the configured radius.

## ESSL Biometric Integration

Webhook endpoint:

```text
POST /api/biometric/log
Header: x-biometric-secret: your_secret
```

Payload:

```json
{
  "deviceId": "ESSL-001",
  "biometricUserId": "EMP001",
  "timestamp": "2026-05-19T09:05:00+05:30",
  "verificationType": "face",
  "eventType": "checkin"
}
```

The API validates the secret, stores the raw log in `biometric_logs`, finds the teacher by `biometricUserId`, and merges the event into the daily attendance document. The placeholder `pollEsslDevicePlaceholder()` in the shared biometric service is where a model-specific ESSL SDK/TCP polling integration should be added later.

## Salary Calculation

Salary is calculated from attendance, holidays, teacher salary settings, and global salary rules.

- Present: paid full day
- Holiday: paid full day
- CL: paid up to teacher monthly CL limit
- Extra CL: unpaid
- Absent: unpaid day
- Late: configurable as none, half day, fixed amount, or one-day deduction after a configured late count

## Demo Data

Demo data is available from the shared package and used by the UI until Firebase collections are connected with live queries.

```bash
npm run seed
```

This prints demo Firestore-ready JSON.

## USB Backup Before Erase

Admin route:

```text
/admin/backup
```

The browser cannot reliably prove a selected folder is a USB drive, so the app uses a guarded workflow:

- Admin downloads a JSON Firestore backup.
- Admin saves that file to the USB drive using the browser save dialog.
- The backup checksum is stored in `backup_audit_logs`.
- Data erase is enabled only after USB confirmation, checksum verification, and the exact phrase `ERASE SCHOOL DATA`.
- Erase removes operational collections and keeps `backup_audit_logs` plus `admin_audit_logs`.
