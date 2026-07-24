import { Platform } from "react-native";
import { auth } from "./firebase";

const API_URL = process.env.EXPO_PUBLIC_WEB_API_URL?.replace(/\/$/, "");
if (!API_URL && Platform.OS !== "web") {
  console.warn("[MobileAPI] EXPO_PUBLIC_WEB_API_URL is not set. Native API calls will fail.");
}
export const API_BASE_URL = API_URL ?? "";
export const API_REQUESTS_AVAILABLE = Platform.OS === "web" || Boolean(API_BASE_URL);

async function getValidToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken(true);
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

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/attendance/mark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Attendance failed");
  return result;
}
