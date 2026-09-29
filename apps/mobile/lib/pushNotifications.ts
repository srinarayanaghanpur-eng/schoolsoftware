/**
 * Expo push notification wiring (Phase 1).
 *
 * - Creates the Android "default" channel and sets a foreground handler.
 * - On notification tap, deep-links via the "sna" scheme / expo-router after
 *   validating payload `data.route` against a route allowlist.
 * - Token lifecycle: ensurePushRegistration() after login and on token
 *   refresh; unregisterPushToken() on logout. Every failure is returned as
 *   data, never thrown.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { auth } from "./firebase";
import { API_BASE_URL, API_REQUESTS_AVAILABLE } from "./api";

const STORED_TOKEN_KEY = "@push:expo_token";

/**
 * First path segments the app can deep-link into. Anything else in a push
 * payload is ignored so a crafted notification can never open an
 * unexpected screen.
 */
const ALLOWED_ROUTE_ROOTS: ReadonlySet<string> = new Set([
  "parent",
  "teacher",
  "admin",
  "accountant",
  "principal",
  "attendance",
  "calendar",
  "desktop",
  "fees",
  "history",
  "home",
  "login",
  "messages",
  "payments",
  "people",
  "profile",
  "reports"
]);

export function isAllowedPushRoute(route: unknown): route is string {
  if (typeof route !== "string" || !route.startsWith("/")) return false;
  if (route === "/") return true;
  const root = route.slice(1).split("/")[0] ?? "";
  return ALLOWED_ROUTE_ROOTS.has(root);
}

export type PushFailureReason =
  | "simulator"
  | "missing-project-id"
  | "denied"
  | "unavailable"
  | "failed";

export type TokenResult = { ok: true; token: string } | { ok: false; reason: PushFailureReason };

/**
 * Foreground handler + Android channel + tap-to-deep-link. Call once at app
 * start; the returned function unsubscribes everything.
 */
export function setupPushListeners(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT
    }).catch(() => undefined);
  }

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (isAllowedPushRoute(route)) {
      router.push(route);
    }
  });

  // Re-register when the OS rotates the device token (guarded: the API is
  // version-dependent and its absence must not break startup).
  const api = Notifications as unknown as {
    addPushTokenListener?: (listener: () => void) => { remove: () => void };
  };
  const tokenSub =
    typeof api.addPushTokenListener === "function"
      ? api.addPushTokenListener(() => {
          void ensurePushRegistration();
        })
      : null;

  return () => {
    responseSub.remove();
    tokenSub?.remove();
  };
}

async function authedPost(path: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user || !API_REQUESTS_AVAILABLE) return false;
    const idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Request permission, fetch the Expo push token and register it server-side.
 * Fails gracefully on simulators, without an EAS projectId, when permission
 * is denied, or when offline — the caller decides whether to surface that.
 */
export async function ensurePushRegistration(): Promise<TokenResult> {
  try {
    if (!Device.isDevice) return { ok: false, reason: "simulator" };
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId || typeof projectId !== "string") {
      return { ok: false, reason: "missing-project-id" };
    }
    // The exact permission-response shape varies across SDKs (boolean
    // `granted` vs string `status`), so read both defensively.
    const permission = await Notifications.requestPermissionsAsync();
    const granted =
      (permission as { granted?: unknown }).granted === true ||
      (permission as { status?: unknown }).status === "granted";
    if (!granted) return { ok: false, reason: "denied" };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return { ok: false, reason: "failed" };
    const registered = await registerTokenWithServer(token);
    if (!registered) return { ok: false, reason: "failed" };
    await AsyncStorage.setItem(STORED_TOKEN_KEY, token).catch(() => undefined);
    return { ok: true, token };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

async function registerTokenWithServer(token: string): Promise<boolean> {
  return authedPost("/api/push/register", { token, platform: Platform.OS });
}

/**
 * Remove the stored token server-side (best-effort) and forget it locally.
 * Call BEFORE signing out so the request still carries auth.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(STORED_TOKEN_KEY).catch(() => null);
    if (token) {
      await authedPost("/api/push/unregister", { token });
    }
  } finally {
    await AsyncStorage.removeItem(STORED_TOKEN_KEY).catch(() => undefined);
  }
}
