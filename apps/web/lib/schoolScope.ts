import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Resolve the caller's school id for scoping queries.
 * Resolution order (same as payrollAccess): custom claim (school_id/schoolId)
 * -> SCHOOL_ID env -> "default-school".
 */
export function getSchoolId(token?: DecodedIdToken | null): string {
  if (token) {
    for (const name of ["school_id", "schoolId"]) {
      const value = token[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return process.env.SCHOOL_ID || "default-school";
}
