/**
 * Driver workspace state.
 *
 * Trips and stop counts are persisted through /api/driver/*. Location and face
 * checks stay local to the device: no GPS or face data is sent to the server.
 * Drivers never receive student names or identifiers, only aggregate counts.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import {
  completeDriverTrip,
  getDriverAssignment,
  saveDriverStop,
  startDriverTrip,
  type DriverAssignment,
  type DriverTripMode
} from "@/lib/driverApi";

export type JourneyMode = "morning" | "evening";
export type JourneyStatus = "idle" | "active" | "completed";
export type LocationPermission = "unknown" | "foreground" | "background" | "denied";

export type DriverStop = {
  id: string;
  name: string;
  eta: string;
  landmark: string;
};

export type DriverProfile = {
  name: string;
  employeeId: string;
  phone: string;
  licenseNo: string;
  licenseExpiry: string;
  busNo: string;
  busModel: string;
  routeName: string;
  routeCode: string;
  capacity: number;
  routeKm: number;
};

export type DriverAttendance = {
  marked: boolean;
  at: string | null;
  confidence: number | null;
};

export type DriverJourney = {
  status: JourneyStatus;
  mode: JourneyMode;
  tripId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  nextStopIndex: number;
  counts: Record<string, number>;
};

export type DriverLocationState = {
  permission: LocationPermission;
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  speed: number | null;
  lastFixAt: number | null;
  error: string | null;
};

type DriverContextValue = {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  profile: DriverProfile;
  stops: DriverStop[];
  mode: DriverTripMode;
  attendance: DriverAttendance;
  journey: DriverJourney;
  location: DriverLocationState;
  now: number;
  distanceKm: number;
  totalStudents: number;
  markAttendance: () => void;
  startJourney: (mode: JourneyMode) => Promise<boolean>;
  endJourney: () => Promise<boolean>;
  completeStop: (stopId: string, count: number) => Promise<boolean>;
  requestLocation: () => Promise<"background" | "foreground" | "denied">;
  refreshLocationPermission: () => Promise<void>;
  openSettings: () => void;
  resetDemo: () => void;
};

const EMPTY_PROFILE: DriverProfile = {
  name: "",
  employeeId: "",
  phone: "",
  licenseNo: "",
  licenseExpiry: "",
  busNo: "",
  busModel: "",
  routeName: "",
  routeCode: "",
  capacity: 0,
  routeKm: 0
};

const INITIAL_ATTENDANCE: DriverAttendance = {
  marked: false,
  at: null,
  confidence: null
};

const INITIAL_JOURNEY: DriverJourney = {
  status: "idle",
  mode: "morning",
  tripId: null,
  startedAt: null,
  endedAt: null,
  nextStopIndex: 0,
  counts: {}
};

const INITIAL_LOCATION: DriverLocationState = {
  permission: "unknown",
  coords: null,
  accuracy: null,
  speed: null,
  lastFixAt: null,
  error: null
};

function toProfile(assignment: DriverAssignment): DriverProfile {
  return {
    name: assignment.name,
    employeeId: assignment.employeeId ?? "",
    phone: assignment.phone ?? "",
    licenseNo: "",
    licenseExpiry: "",
    busNo: assignment.busNo,
    busModel: assignment.busModel,
    routeName: assignment.routeName,
    routeCode: assignment.routeCode ?? assignment.routeId,
    capacity: assignment.capacity,
    routeKm: assignment.routeKm ?? 0
  };
}

function toStops(assignment: DriverAssignment): DriverStop[] {
  return assignment.stops.map((stop) => ({
    id: String(stop.index),
    name: stop.name,
    eta: "",
    landmark: ""
  }));
}

const DriverContext = createContext<DriverContextValue | null>(null);

export function DriverDemoProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DriverProfile>(EMPTY_PROFILE);
  const [stops, setStops] = useState<DriverStop[]>([]);
  const [mode, setMode] = useState<DriverTripMode>("daily");
  const [attendance, setAttendance] = useState<DriverAttendance>(INITIAL_ATTENDANCE);
  const [journey, setJourney] = useState<DriverJourney>(INITIAL_JOURNEY);
  const [location, setLocation] = useState<DriverLocationState>(INITIAL_LOCATION);
  const [now, setNow] = useState(Date.now());
  const keepAlive = useRef(true);

  useEffect(() => {
    if (journey.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [journey.status]);

  useEffect(() => {
    keepAlive.current = true;
    return () => {
      keepAlive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assignment = await getDriverAssignment();
      if (!keepAlive.current) return;
      setProfile(toProfile(assignment));
      setStops(toStops(assignment));
      setMode(assignment.mode);
    } catch (err) {
      if (!keepAlive.current) return;
      setError(err instanceof Error ? err.message : "Unable to load driver assignment");
    } finally {
      if (keepAlive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshLocationPermission = useCallback(async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      let permission: LocationPermission =
        foreground.status === "granted"
          ? "foreground"
          : foreground.status === "denied"
            ? "denied"
            : "unknown";

      if (permission === "foreground" && Platform.OS === "android") {
        const background = await Location.getBackgroundPermissionsAsync();
        if (background.status === "granted") permission = "background";
      }

      if (keepAlive.current) {
        setLocation((current) => ({ ...current, permission }));
      }
    } catch {
      if (keepAlive.current) {
        setLocation((current) => ({ ...current, permission: "unknown" }));
      }
    }
  }, []);

  useEffect(() => {
    void refreshLocationPermission();
  }, [refreshLocationPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshLocationPermission();
    });
    return () => subscription.remove();
  }, [refreshLocationPermission]);

  const requestLocation = useCallback(async (): Promise<"background" | "foreground" | "denied"> => {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== "granted") {
        setLocation((current) => ({
          ...current,
          permission: "denied",
          error: "Location is required to start a bus journey."
        }));
        return "denied";
      }

      let permission: "background" | "foreground" = "foreground";
      if (Platform.OS === "android") {
        try {
          const background = await Location.requestBackgroundPermissionsAsync();
          if (background.status === "granted") permission = "background";
        } catch {
          permission = "foreground";
        }
      }

      setLocation((current) => ({
        ...current,
        permission,
        error:
          permission === "foreground"
            ? "Choose Allow all the time in phone settings so tracking continues with the screen off."
            : null
      }));
      return permission;
    } catch {
      setLocation((current) => ({
        ...current,
        permission: "denied",
        error: "Could not access location. Open phone settings and allow location."
      }));
      return "denied";
    }
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useEffect(() => {
    if (journey.status !== "active") return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const foreground = await Location.getForegroundPermissionsAsync();
        if (cancelled || foreground.status !== "granted") return;

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10
          },
          (position) => {
            if (!keepAlive.current) return;
            setLocation((current) => ({
              ...current,
              permission: current.permission === "background" ? "background" : "foreground",
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              },
              accuracy: position.coords.accuracy ?? null,
              speed: position.coords.speed ?? null,
              lastFixAt: Date.now(),
              error: null
            }));
          }
        );
      } catch {
        // The UI keeps showing the permission card and the driver can retry.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [journey.status]);

  const markAttendance = useCallback(() => {
    const at = new Date();
    setAttendance({
      marked: true,
      at: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      confidence: null
    });
  }, []);

  const startJourney = useCallback(async (nextMode: JourneyMode) => {
    setError(null);
    try {
      const trip = await startDriverTrip(nextMode === "morning" ? "pickup" : "drop");
      setNow(Date.now());
      setJourney({
        status: "active",
        mode: nextMode,
        tripId: trip.id || null,
        startedAt: Date.now(),
        endedAt: null,
        nextStopIndex: 0,
        counts: {}
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start trip");
      return false;
    }
  }, []);

  const endJourney = useCallback(async () => {
    const tripId = journey.tripId;
    if (!tripId) return false;
    try {
      await completeDriverTrip(tripId);
      setJourney((current) => ({
        ...current,
        status: "completed",
        endedAt: Date.now()
      }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to end trip");
      return false;
    }
  }, [journey.tripId]);

  const completeStop = useCallback(async (stopId: string, count: number) => {
    const tripId = journey.tripId;
    if (!tripId || journey.status !== "active") return false;
    const index = stops.findIndex((stop) => stop.id === stopId);
    if (index < 0) return false;
    const stop = stops[index];
    const safeCount = Math.max(0, Math.round(count));
    const boarded = journey.mode === "morning" ? safeCount : 0;
    const alighted = journey.mode === "morning" ? 0 : safeCount;

    setError(null);
    try {
      await saveDriverStop({
        tripId,
        stopIndex: index,
        stopName: stop.name,
        boarded,
        alighted
      });
      setJourney((current) => ({
        ...current,
        counts: { ...current.counts, [stopId]: safeCount },
        nextStopIndex: Math.max(current.nextStopIndex, index + 1)
      }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save stop count");
      return false;
    }
  }, [journey.mode, journey.status, journey.tripId, stops]);

  const resetDemo = useCallback(() => {
    setAttendance(INITIAL_ATTENDANCE);
    setJourney(INITIAL_JOURNEY);
    setLocation((current) => ({ ...current, error: null }));
    void refresh();
  }, [refresh]);

  const totalStudents = useMemo(
    () => Object.values(journey.counts).reduce((sum, value) => sum + value, 0),
    [journey.counts]
  );

  const distanceKm = useMemo(() => {
    if (stops.length === 0) return 0;
    return Math.round((profile.routeKm * (journey.nextStopIndex / stops.length)) * 10) / 10;
  }, [journey.nextStopIndex, profile.routeKm, stops.length]);

  const value = useMemo<DriverContextValue>(
    () => ({
      loading,
      error,
      refresh,
      profile,
      stops,
      mode,
      attendance,
      journey,
      location,
      now,
      distanceKm,
      totalStudents,
      markAttendance,
      startJourney,
      endJourney,
      completeStop,
      requestLocation,
      refreshLocationPermission,
      openSettings,
      resetDemo
    }),
    [
      loading,
      error,
      refresh,
      profile,
      stops,
      mode,
      attendance,
      journey,
      location,
      now,
      distanceKm,
      totalStudents,
      markAttendance,
      startJourney,
      endJourney,
      completeStop,
      requestLocation,
      refreshLocationPermission,
      openSettings,
      resetDemo
    ]
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}

export function useDriverDemo() {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error("useDriverDemo must be used inside DriverDemoProvider");
  }
  return context;
}
