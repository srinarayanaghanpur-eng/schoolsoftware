"use client";

type LogEntry = {
  page: string;
  collection: string;
  operation: "getDoc" | "getDocs" | "onSnapshot" | "setDoc" | "updateDoc" | "addDoc" | "deleteDoc";
  queryPurpose: string;
  filters: string;
  limit: number | null;
  docsReturned: number;
  durationMs: number;
  timestamp: string;
  warning: string;
};

const logs: LogEntry[] = [];
const MAX_LOGS = 500;
let enabled = process.env.NODE_ENV === "development";

export function enableDebugLogging(enable = true) {
  enabled = enable;
}

export function getFirestoreDebugLogs(): LogEntry[] {
  return [...logs];
}

export function clearFirestoreDebugLogs() {
  logs.length = 0;
}

export function printFirestoreUsageReport() {
  if (logs.length === 0) return;
  const grouped: Record<string, { reads: number; writes: number; docsReturned: number; calls: number }> = {};
  for (const entry of logs) {
    const key = `${entry.page} :: ${entry.collection}`;
    if (!grouped[key]) {
      grouped[key] = { reads: 0, writes: 0, docsReturned: 0, calls: 0 };
    }
    const isWrite = ["setDoc", "updateDoc", "addDoc", "deleteDoc"].includes(entry.operation);
    if (isWrite) grouped[key].writes++;
    else grouped[key].reads++;
    grouped[key].docsReturned += entry.docsReturned;
    grouped[key].calls++;
  }
  console.table(
    Object.entries(grouped)
      .map(([key, val]) => ({
        key,
        ...val
      }))
      .sort((a, b) => b.docsReturned - a.docsReturned)
  );
}

export function logFirestoreOperation(params: {
  page: string;
  collection: string;
  operation: LogEntry["operation"];
  queryPurpose: string;
  filters?: string;
  limit?: number | null;
  docsReturned?: number;
  durationMs?: number;
}) {
  if (!enabled) return;
  const entry: LogEntry = {
    page: params.page,
    collection: params.collection,
    operation: params.operation,
    queryPurpose: params.queryPurpose,
    filters: params.filters || "",
    limit: params.limit ?? null,
    docsReturned: params.docsReturned ?? 0,
    durationMs: params.durationMs ?? 0,
    timestamp: new Date().toISOString(),
    warning: ""
  };
  if (entry.docsReturned > 100) {
    entry.warning = `⚠️ HIGH READ: ${entry.docsReturned} docs returned from ${entry.collection}`;
    console.warn(`[Firestore] ${entry.warning} (${entry.page} :: ${entry.queryPurpose})`);
  }
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
}

export function createTimedLogger(page: string) {
  return {
    start(collection: string, operation: LogEntry["operation"], queryPurpose: string, filters?: string, queryLimit?: number | null) {
      const startTime = performance.now();
      return (docsReturned: number) => {
        logFirestoreOperation({
          page,
          collection,
          operation,
          queryPurpose,
          filters,
          limit: queryLimit,
          docsReturned,
          durationMs: Math.round(performance.now() - startTime)
        });
      };
    }
  };
}
