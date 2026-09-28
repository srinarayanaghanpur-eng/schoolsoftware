import { Platform } from "react-native";
import { auth } from "./firebase";

const API_URL = process.env.EXPO_PUBLIC_WEB_API_URL?.replace(/\/$/, "");
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

export async function postAttendance(payload: Record<string, unknown>) {
  const token = await getValidToken();

  if (!API_REQUESTS_AVAILABLE) {
    throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  }

  // Deterministic idempotency key: retries of the same payroll event carry
  // the same key, so the server can dedupe them (see /api/attendance/mark).
  const clientRequestId = [payload.teacherId, payload.eventType, payload.timestamp]
    .map((part) => String(part ?? ""))
    .join(":");

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/attendance/mark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ ...payload, clientRequestId })
  });
  const text = await response.text();
  let result: { error?: string } & Record<string, unknown> = {};
  try {
    result = text ? (JSON.parse(text) as typeof result) : {};
  } catch {
    // Non-JSON body (proxy error page, empty 204, …): fall through to the
    // status check below instead of crashing on a parse error.
  }
  if (!response.ok) throw new Error(result.error ?? "Attendance failed");
  return result;
}
