import { Platform } from "react-native";
import { auth } from "./firebase";

const ENV_URL = process.env.EXPO_PUBLIC_WEB_API_URL?.replace(/\/$/, "");
// On web with no baked URL, talk to whichever host served the app — this
// keeps previews and deployments working without rebuilding per host.
// (Native has no page origin, so it still requires the env var.)
const WEB_ORIGIN =
  Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin
    ? window.location.origin.replace(/\/$/, "")
    : "";
const API_URL = ENV_URL || WEB_ORIGIN;
if (!API_URL && Platform.OS !== "web" && __DEV__) {
  console.warn("[MobileAPI] EXPO_PUBLIC_WEB_API_URL is not set. Native API calls will fail.");
}
export const API_BASE_URL = API_URL ?? "";
export const API_REQUESTS_AVAILABLE = Platform.OS === "web" || Boolean(API_BASE_URL);

async function getValidToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  // No force-refresh: Firebase returns the cached token and refreshes it
  // automatically when expired. Forcing refresh on every call adds latency
  // and burns through the token-service quota.
  const token = await user.getIdToken();
  return token;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export class AttendanceSubmitError extends Error {
  /** HTTP status when the server answered; undefined on network failure. */
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AttendanceSubmitError";
    this.status = status;
  }
}

export async function postAttendance(
  payload: Record<string, unknown>,
  opts?: { clientRequestId?: string; capturedAt?: string }
) {
  const token = await getValidToken();

  if (!API_REQUESTS_AVAILABLE) {
    throw new AttendanceSubmitError("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  }

  // Deterministic idempotency key for live attempts (retries of the same
  // payroll event carry the same key); queued offline attempts pass their
  // own uuid via opts so each attempt stays unique.
  const clientRequestId =
    opts?.clientRequestId ??
    [payload.teacherId, payload.eventType, payload.timestamp]
      .map((part) => String(part ?? ""))
      .join(":");

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/attendance/mark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        ...payload,
        clientRequestId,
        ...(opts?.capturedAt ? { capturedAt: opts.capturedAt } : {})
      })
    });
  } catch (err) {
    throw new AttendanceSubmitError(
      err instanceof Error ? err.message : "Network request failed."
    );
  }
  const text = await response.text();
  let result: { error?: string } & Record<string, unknown> = {};
  try {
    result = text ? (JSON.parse(text) as typeof result) : {};
  } catch {
    // Non-JSON body (proxy error page, empty 204, …): fall through to the
    // status check below instead of crashing on a parse error.
  }
  if (!response.ok) throw new AttendanceSubmitError(result.error ?? "Attendance failed", response.status);
  return result;
}
