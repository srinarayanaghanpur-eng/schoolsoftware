import { Platform } from "react-native";
import { DEFAULT_SETTINGS, type AppLockSettings } from "@sri-narayana/shared";
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

export type ApiErrorKind = "offline" | "timeout" | "server" | "auth" | "client" | "unknown";

/** Error carrying a user-facing category so screens can show a distinct message. */
export class ApiRequestError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, kind: ApiErrorKind, status?: number, retryable = false) {
    super(message);
    this.name = "ApiRequestError";
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
  }
}

const OFFLINE_MESSAGE = "You're offline. Check your internet connection and try again.";
const TIMEOUT_MESSAGE = "The server took too long to respond. Please try again.";

function serverMessage(status: number) {
  return `The server is temporarily unavailable (${status}). Please try again.`;
}

// Vercel cold starts can take a while; only the very first request in the JS
// runtime gets the longer budget, then normal requests use 15s.
const COLD_START_TIMEOUT_MS = 25000;
const DEFAULT_TIMEOUT_MS = 15000;
let coldStartPending = true;

function nextTimeoutMs() {
  if (coldStartPending) {
    coldStartPending = false;
    return COLD_START_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
}

function classifyFetchError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return new ApiRequestError(TIMEOUT_MESSAGE, "timeout", undefined, true);
  }
  const message = error instanceof Error ? error.message : "";
  if (/network request failed|failed to fetch|network error|load failed/i.test(message)) {
    return new ApiRequestError(OFFLINE_MESSAGE, "offline", undefined, true);
  }
  return new ApiRequestError("Something went wrong. Please try again.", "unknown", undefined, false);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiRequestError(TIMEOUT_MESSAGE, "timeout", undefined, true);
    throw classifyFetchError(error);
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function retryDelay(attempt: number) {
  return 500 * 2 ** attempt;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApiFetchOptions = {
  /** Retry idempotent requests (GET, and attendance POST which carries a key). */
  retry?: boolean;
};

/**
 * Fetch wrapper with cold-start timeout and exponential backoff.
 * Retries network errors, timeouts and 502/503/504 (max 2 retries).
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  opts: ApiFetchOptions = {}
): Promise<Response> {
  const retries = opts.retry === true ? 2 : 0;
  let lastError: ApiRequestError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelay(attempt - 1));
    }
    const timeoutMs = nextTimeoutMs();
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (isRetryableStatus(response.status) && attempt < retries) {
        lastError = new ApiRequestError(serverMessage(response.status), "server", response.status, true);
        continue;
      }
      return response;
    } catch (error) {
      const apiError = classifyFetchError(error);
      if (apiError.retryable && attempt < retries) {
        lastError = apiError;
        continue;
      }
      throw apiError;
    }
  }

  throw lastError ?? new ApiRequestError("Request failed. Please try again.", "unknown");
}

/** Parse a JSON body, turning malformed proxy/HTML responses into a clean error. */
export async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiRequestError(
      "The server returned an invalid response. Please try again.",
      "server",
      response.status
    );
  }
}

/** Convert a non-2xx response into a user-facing, categorised error. */
export async function responseError(
  response: Response,
  fallback = "Request failed. Please try again."
): Promise<ApiRequestError> {
  let message = "";
  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
        if (typeof parsed.error === "string" && parsed.error.trim()) {
          message = parsed.error.trim();
        } else if (typeof parsed.message === "string" && parsed.message.trim()) {
          message = parsed.message.trim();
        }
      } catch {
        message = text.slice(0, 200);
      }
    }
  } catch {
    // Body already consumed or unreadable; fall back to a generic message.
  }

  if (response.status === 401 || response.status === 403) {
    return new ApiRequestError(
      message || "Your session expired. Please sign in again.",
      "auth",
      response.status,
      false
    );
  }
  if (response.status >= 500) {
    return new ApiRequestError(
      message.length > 0 && message.length <= 200 ? message : serverMessage(response.status),
      "server",
      response.status,
      false
    );
  }
  return new ApiRequestError(message || fallback, "client", response.status, false);
}

export async function getValidToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  // No force-refresh: Firebase returns the cached token and refreshes it
  // automatically when expired. Forcing refresh on every call adds latency
  // and burns through the token-service quota.
  const token = await user.getIdToken();
  return token;
}

export type AppLockConfig = AppLockSettings;

let appLockConfigCache: AppLockConfig | null = null;

export async function getAppLockConfig(force = false): Promise<AppLockConfig> {
  if (!force && appLockConfigCache) return appLockConfigCache;
  if (!API_REQUESTS_AVAILABLE) {
    return DEFAULT_SETTINGS.appLock ?? {
      enabled: false,
      lockOnStartup: true,
      timeoutMinutes: 5,
      allowDeviceFallback: true,
      roles: []
    };
  }
  const token = await getValidToken();
  const response = await apiFetch(
    `${API_BASE_URL}/api/settings/app-lock`,
    { headers: { Authorization: `Bearer ${token}` } },
    { retry: true }
  );
  if (!response.ok) {
    throw await responseError(response, "Unable to load app lock settings");
  }
  const result = await readJson<{ ok?: boolean; appLock?: Partial<AppLockConfig> }>(response);
  const fallback = DEFAULT_SETTINGS.appLock;
  const appLock: AppLockConfig = {
    enabled: result.appLock?.enabled === true,
    lockOnStartup: result.appLock?.lockOnStartup !== false,
    timeoutMinutes:
      typeof result.appLock?.timeoutMinutes === "number"
        ? Math.max(0, Math.min(240, result.appLock.timeoutMinutes))
        : fallback?.timeoutMinutes ?? 5,
    allowDeviceFallback: result.appLock?.allowDeviceFallback !== false,
    roles: Array.isArray(result.appLock?.roles) && result.appLock.roles.length > 0
      ? result.appLock.roles
      : fallback?.roles ?? []
  };
  appLockConfigCache = appLock;
  return appLock;
}

export type AttendanceConfig = {
  requireSelfie: boolean;
  campusLatitude?: number;
  campusLongitude?: number;
  geofenceRadiusMeters?: number;
};

let attendanceConfigCache: AttendanceConfig | null = null;

/** School attendance switches the mobile client must know before capturing. */
export async function getAttendanceConfig(): Promise<AttendanceConfig> {
  if (attendanceConfigCache) return attendanceConfigCache;
  if (!API_REQUESTS_AVAILABLE) {
    return { requireSelfie: false };
  }
  const token = await getValidToken();
  const response = await apiFetch(
    `${API_BASE_URL}/api/attendance/config`,
    { headers: { Authorization: `Bearer ${token}` } },
    { retry: true }
  );
  if (!response.ok) {
    throw await responseError(response, "Unable to load attendance settings");
  }
  const result = await readJson<AttendanceConfig>(response);
  attendanceConfigCache = {
    requireSelfie: Boolean(result.requireSelfie),
    campusLatitude: typeof result.campusLatitude === "number" ? result.campusLatitude : undefined,
    campusLongitude: typeof result.campusLongitude === "number" ? result.campusLongitude : undefined,
    geofenceRadiusMeters:
      typeof result.geofenceRadiusMeters === "number" ? result.geofenceRadiusMeters : undefined
  };
  return attendanceConfigCache;
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
    // Attendance is the only POST we retry: the server dedupes by
    // clientRequestId, so repeat submissions cannot double-record a day.
    response = await apiFetch(
      `${API_BASE_URL}/api/attendance/mark`,
      {
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
      },
      { retry: true }
    );
  } catch (err) {
    if (err instanceof ApiRequestError) {
      throw new AttendanceSubmitError(err.message, err.status);
    }
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
  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? serverMessage(response.status)
        : "Attendance failed";
    throw new AttendanceSubmitError(result.error ?? fallback, response.status);
  }
  return result;
}
