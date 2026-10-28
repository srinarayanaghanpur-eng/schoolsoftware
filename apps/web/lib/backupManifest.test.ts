import assert from "node:assert/strict";
import test from "node:test";
import {
  createBackupManifest,
  normalizeCollectionNames,
  serializeFirestoreValue,
  validateBackupCoverage,
  validateBackupDocumentCounts
} from "./backupManifest";

test("restore drill: backup payload round-trips and covers erased collections", () => {
  const entries = {
    students: [{ id: "s1", data: { studentName: "Asha" } }],
    payments: [{ id: "p1", data: { amountPaid: 5000 } }],
    studentFeeSummaries: [{ id: "s1_2026", data: { dueAmount: 5000 } }],
    settings: [{ id: "school", data: {} }]
  };
  const manifest = createBackupManifest(entries);
  const payload = JSON.stringify({ collections: entries, manifest }, null, 2);
  const restored = JSON.parse(payload) as {
    collections: typeof entries;
    manifest: typeof manifest;
  };

  assert.equal(restored.collections.students[0].data.studentName, "Asha");
  assert.equal(restored.collections.payments[0].data.amountPaid, 5000);
  assert.deepEqual(restored.manifest.collectionNames, [
    "payments",
    "settings",
    "studentFeeSummaries",
    "students"
  ]);
  assert.deepEqual(
    validateBackupCoverage(Object.keys(entries), restored.manifest),
    { ok: true, missing: [], extra: [] }
  );
});

test("erase is refused when the backup predates a fee collection", () => {
  const oldBackup = createBackupManifest({
    users: [{ id: "u1", data: {} }],
    teachers: [{ id: "t1", data: {} }]
  });

  const result = validateBackupCoverage(
    ["users", "teachers", "students", "payments", "studentFeeSummaries"],
    oldBackup
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /payments, studentFeeSummaries, students/);
});

test("erase is refused when a new collection is added after backup", () => {
  const manifest = createBackupManifest({
    students: [{ id: "s1", data: {} }],
    payments: [{ id: "p1", data: {} }]
  });

  const result = validateBackupCoverage(["students", "payments", "hostel"], manifest);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["hostel"]);
});

test("erase is refused when data was added after the backup", () => {
  const manifest = createBackupManifest({
    students: [{ id: "s1", data: {} }],
    payments: [{ id: "p1", data: {} }]
  });

  const result = validateBackupDocumentCounts({ students: 2, payments: 1 }, manifest);

  assert.equal(result.ok, false);
  assert.deepEqual(result.mismatches, [
    { collection: "students", expected: 1, actual: 2 }
  ]);
});

test("document counts match the current data after a clean backup", () => {
  const manifest = createBackupManifest({
    students: [{ id: "s1", data: {} }],
    payments: [{ id: "p1", data: {} }]
  });

  assert.deepEqual(
    validateBackupDocumentCounts({ students: 1, payments: 1 }, manifest),
    { ok: true, mismatches: [] }
  );
});

test("preserved audit collections are not required in the backup manifest", () => {
  const manifest = createBackupManifest({
    students: [{ id: "s1", data: {} }]
  });

  const result = validateBackupCoverage(
    ["students", "backup_audit_logs", "admin_audit_logs", "audit_logs"],
    manifest
  );

  assert.equal(result.ok, true);
  assert.deepEqual(normalizeCollectionNames(["students", "backup_audit_logs"]), ["students"]);
});

test("Firestore timestamps and nested values serialize for restore", () => {
  const serialized = serializeFirestoreValue({
    createdAt: { toDate: () => new Date("2026-10-28T00:00:00.000Z") },
    nested: { amount: 100, tags: ["a", { toDate: () => new Date("2026-10-29T00:00:00.000Z") }] }
  });

  assert.deepEqual(serialized, {
    createdAt: "2026-10-28T00:00:00.000Z",
    nested: {
      amount: 100,
      tags: ["a", "2026-10-29T00:00:00.000Z"]
    }
  });
});
