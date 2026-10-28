export const PRESERVED_COLLECTIONS = new Set([
  "backup_audit_logs",
  "admin_audit_logs",
  "audit_logs"
]);

export function isPreservedCollection(name: string): boolean {
  return PRESERVED_COLLECTIONS.has(name);
}

export function serializeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      serializeFirestoreValue(item)
    ])
  );
}

export function normalizeCollectionNames(names: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(names)
        .map((name) => String(name || "").trim())
        .filter((name) => name && !isPreservedCollection(name))
    )
  ).sort();
}

export type BackupManifest = {
  manifestVersion: number;
  collectionNames: string[];
  documentCounts: Record<string, number>;
};

export function createBackupManifest(
  entries: Record<string, Array<unknown>>
): BackupManifest {
  const collectionNames = normalizeCollectionNames(Object.keys(entries));
  return {
    manifestVersion: 1,
    collectionNames,
    documentCounts: Object.fromEntries(
      collectionNames.map((name) => [name, entries[name]?.length ?? 0])
    )
  };
}

export type BackupCoverageResult =
  | { ok: true; missing: []; extra: string[] }
  | { ok: false; error: string; missing: string[]; extra: string[] };

export type BackupCountMismatch = {
  collection: string;
  expected: number;
  actual: number;
};

export type BackupCountResult =
  | { ok: true; mismatches: [] }
  | { ok: false; error: string; mismatches: BackupCountMismatch[] };

export function validateBackupCoverage(
  currentCollectionNames: Iterable<string>,
  manifest: unknown
): BackupCoverageResult {
  const current = normalizeCollectionNames(currentCollectionNames);
  const raw =
    manifest && typeof manifest === "object"
      ? (manifest as { collectionNames?: unknown })
      : null;
  if (!raw || !Array.isArray(raw.collectionNames)) {
    return {
      ok: false,
      error: "Backup manifest is missing or unreadable. Generate a new backup before erasing.",
      missing: current,
      extra: []
    };
  }

  const covered = normalizeCollectionNames(
    raw.collectionNames.map((name) => String(name ?? ""))
  );
  const missing = current.filter((name) => !covered.includes(name));
  const extra = covered.filter((name) => !current.includes(name));

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Backup does not cover current collection(s): ${missing.join(", ")}. Generate a new backup before erasing.`,
      missing,
      extra
    };
  }

  return { ok: true, missing: [], extra };
}

export function validateBackupDocumentCounts(
  currentCounts: Record<string, number>,
  manifest: unknown
): BackupCountResult {
  const raw =
    manifest && typeof manifest === "object"
      ? (manifest as { documentCounts?: unknown })
      : null;
  const counts =
    raw?.documentCounts && typeof raw.documentCounts === "object"
      ? (raw.documentCounts as Record<string, unknown>)
      : null;
  if (!counts) {
    return {
      ok: false,
      error: "Backup manifest is missing document counts. Generate a new backup before erasing.",
      mismatches: []
    };
  }

  const mismatches = normalizeCollectionNames(Object.keys(currentCounts))
    .map((collection) => {
      const expected = Number(counts[collection]);
      const actual = Number(currentCounts[collection]);
      return { collection, expected, actual };
    })
    .filter(({ expected, actual }) => !Number.isFinite(expected) || expected !== actual);

  if (mismatches.length > 0) {
    return {
      ok: false,
      error: `Backup does not match current data in: ${mismatches
        .map(({ collection, expected, actual }) => `${collection} (backup ${expected}, current ${actual})`)
        .join(", ")}. Generate a new backup before erasing.`,
      mismatches
    };
  }

  return { ok: true, mismatches: [] };
}
