import { auth } from "./firebase";
import { API_BASE_URL, API_REQUESTS_AVAILABLE, apiFetch, readJson, responseError } from "./api";

export type DriverTripMode = "first_day" | "daily" | "combined";
export type DriverDirection = "pickup" | "drop";

export type DriverAssignment = {
  driverId: string;
  name: string;
  employeeId?: string;
  phone?: string;
  vehicleId: string;
  busNo: string;
  busModel: string;
  capacity: number;
  routeId: string;
  routeName: string;
  routeCode?: string;
  routeKm?: number;
  mode: DriverTripMode;
  baselineDate?: string;
  stops: { index: number; name: string }[];
};

export type DriverTrip = {
  id: string;
  date?: string;
  direction?: DriverDirection;
  mode?: DriverTripMode;
  status?: string;
  totalBoarded?: number;
  totalAlighted?: number;
  startedAt?: string;
  completedAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_REQUESTS_AVAILABLE) {
    throw new Error("API URL not configured. Please set EXPO_PUBLIC_WEB_API_URL.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();
  const response = await apiFetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {})
      }
    },
    { retry: init?.method === "GET" || init?.method === undefined }
  );
  if (!response.ok) {
    throw await responseError(response, "Driver request failed");
  }
  return readJson<T>(response);
}

export async function getDriverAssignment(): Promise<DriverAssignment> {
  const result = await request<{ ok: boolean; assignment: DriverAssignment }>("/api/driver/assignment");
  return result.assignment;
}

export async function getDriverTrips(limit = 20): Promise<DriverTrip[]> {
  const result = await request<{ ok: boolean; trips: DriverTrip[] }>(`/api/driver/trips?limit=${limit}`);
  return result.trips ?? [];
}

export async function startDriverTrip(direction: DriverDirection): Promise<DriverTrip> {
  const result = await request<{ ok: boolean; id?: string; trip?: DriverTrip }>("/api/driver/trips", {
    method: "POST",
    body: JSON.stringify({ direction })
  });
  return result.trip ?? ({ id: result.id ?? "", direction, status: "active" } as DriverTrip);
}

export async function saveDriverStop(params: {
  tripId: string;
  stopIndex: number;
  stopName: string;
  boarded: number;
  alighted: number;
}): Promise<void> {
  await request(`/api/driver/trips/${params.tripId}/stops`, {
    method: "POST",
    body: JSON.stringify({
      stopIndex: params.stopIndex,
      stopName: params.stopName,
      boarded: params.boarded,
      alighted: params.alighted
    })
  });
}

export async function completeDriverTrip(tripId: string): Promise<void> {
  await request(`/api/driver/trips/${tripId}/complete`, { method: "POST", body: JSON.stringify({}) });
}
