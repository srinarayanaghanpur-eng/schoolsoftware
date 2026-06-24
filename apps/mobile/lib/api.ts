import { auth } from "./firebase";

export const API_BASE_URL = process.env.EXPO_PUBLIC_WEB_API_URL ?? "http://localhost:3000";

export async function postAttendance(payload: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again.");

  const response = await fetch(`${API_BASE_URL}/api/attendance/mark`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Attendance failed");
  return result;
}
