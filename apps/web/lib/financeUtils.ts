// Helpers for finance aggregation endpoints.

/** Best-effort YYYY-MM-DD for a doc, preferring an explicit `date`, else `createdAt`/`paidAt`. */
export function docDateKey(data: Record<string, unknown>, ...prefer: string[]): string {
  for (const field of [...prefer, "date", "paidAt", "createdAt"]) {
    const v = data?.[field];
    if (typeof v === "string" && v) return v.slice(0, 10);
    if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
      return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    }
  }
  return "";
}

export function inRange(key: string, from?: string | null, to?: string | null): boolean {
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}
