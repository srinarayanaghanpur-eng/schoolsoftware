import {
  API_BASE_URL,
  API_REQUESTS_AVAILABLE,
  AttendanceSubmitError,
  apiFetch,
  getValidToken,
  readJson,
  responseError
} from "@/lib/api";
import type { FaceAttendanceSettings } from "@sri-narayana/shared";

export type FaceGalleryCandidate = {
  teacherId: string;
  fullName: string;
  employeeId: string;
  embedding: number[];
  modelVersion: string;
};

export type FaceGallery = {
  enabled: boolean;
  deviceStatus: "pending" | "approved" | "rejected" | "revoked";
  shared: boolean;
  matchThreshold: number;
  requireLiveness: boolean;
  modelVersion: string;
  candidates: FaceGalleryCandidate[];
};

export type FaceDevice = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  platform: string;
};

function assertAvailable() {
  if (!API_REQUESTS_AVAILABLE) {
    throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  }
}

async function authHeaders() {
  const token = await getValidToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function getFaceAttendanceSettings(): Promise<FaceAttendanceSettings> {
  assertAvailable();
  return getFaceAttendanceSettingsFrom(`${API_BASE_URL}/api/settings/face-attendance`);
}

async function getFaceAttendanceSettingsFrom(url: string): Promise<FaceAttendanceSettings> {
  const response = await apiFetch(url, { headers: await authHeaders() }, { retry: true });
  if (!response.ok) {
    throw await responseError(response, "Unable to load face attendance settings");
  }
  const result = await readJson<{ ok?: boolean; faceAttendance?: FaceAttendanceSettings }>(response);
  if (!result.faceAttendance) throw new Error("Face attendance settings are unavailable.");
  return result.faceAttendance;
}

export async function registerFaceDevice(input: {
  deviceId: string;
  name: string;
  platform: string;
  appVersion?: string;
}): Promise<FaceDevice> {
  assertAvailable();
  const response = await apiFetch(
    `${API_BASE_URL}/api/attendance/face/device`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(input)
    },
    { retry: true }
  );
  if (!response.ok) {
    throw await responseError(response, "Unable to register this device");
  }
  const result = await readJson<{ ok?: boolean; device?: FaceDevice }>(response);
  if (!result.device) throw new Error("The server did not return this device.");
  return result.device;
}

export async function getFaceGallery(deviceId: string): Promise<FaceGallery> {
  assertAvailable();
  const response = await apiFetch(
    `${API_BASE_URL}/api/attendance/face/gallery?deviceId=${encodeURIComponent(deviceId)}`,
    { headers: await authHeaders() },
    { retry: true }
  );
  if (!response.ok) {
    throw await responseError(response, "Unable to load face profiles");
  }
  const result = await readJson<FaceGallery & { ok?: boolean }>(response);
  return {
    enabled: result.enabled !== false,
    deviceStatus: result.deviceStatus ?? "pending",
    shared: result.shared === true,
    matchThreshold:
      typeof result.matchThreshold === "number" ? result.matchThreshold : 0.6,
    requireLiveness: result.requireLiveness !== false,
    modelVersion: result.modelVersion ?? "mobilefacenet-192-v1",
    candidates: Array.isArray(result.candidates) ? result.candidates : []
  };
}

export async function postFaceAttendance(
  payload: Record<string, unknown>,
  opts?: { clientRequestId?: string; capturedAt?: string }
) {
  assertAvailable();
  const clientRequestId =
    opts?.clientRequestId ??
    [payload.teacherId, payload.eventType, payload.timestamp]
      .map((part) => String(part ?? ""))
      .join(":");

  let response: Response;
  try {
    response = await apiFetch(
      `${API_BASE_URL}/api/attendance/face`,
      {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          ...payload,
          clientRequestId,
          ...(opts?.capturedAt ? { capturedAt: opts.capturedAt } : {})
        })
      },
      { retry: true }
    );
  } catch (err) {
    if (err instanceof Error) throw new AttendanceSubmitError(err.message);
    throw new AttendanceSubmitError("Network request failed.");
  }

  const text = await response.text();
  let result: { ok?: boolean; error?: string; attendance?: unknown; teacher?: unknown } = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = {};
  }
  if (!response.ok) {
    throw new AttendanceSubmitError(
      result.error ?? "Face attendance failed.",
      response.status
    );
  }
  return result;
}
