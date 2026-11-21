/**
 * Headless GPS attendance flow — the one genuine business path in the mobile
 * app, extracted from the old app/attendance.tsx so no UI owns it.
 *
 * permission → getCurrentPositionAsync → geofence check → POST /api/attendance/mark
 * The server re-validates the geofence; the client check is a fast-fail UX guard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Device from "expo-device";
import {
  ATTENDANCE_BYPASS_GPS_AND_TIME,
  DEFAULT_SETTINGS,
  getDistanceFromCampus,
  isInsideCampus
} from "@sri-narayana/shared";
import { AttendanceSubmitError, getAttendanceConfig, postAttendance } from "@/lib/api";
import {
  buildQueuedPayload,
  capQueue,
  classifySubmitFailure,
  newUuid,
  OFFLINE_QUEUE_CAP,
  type QueuedAttempt
} from "@/lib/offlineQueue";

// Server/shared vocabulary is "checkin"/"checkout" (AttendanceEventType).
// The old "check_in"/"check_out" values failed server-side window validation
// and stored records the admin UI couldn't interpret.
export type AttendanceEvent = "checkin" | "checkout";

type MarkingState = {
  /** Metres from campus centre, or null until a fix is acquired. */
  distance: number | null;
  insideCampus: boolean;
  accuracy: number | null;
  permission: "unknown" | "granted" | "denied";
  locating: boolean;
  submitting: boolean;
  error: string | null;
  /** Queued offline attempts awaiting sync. */
  pending: number;
  syncing: boolean;
};

const INITIAL: MarkingState = {
  distance: null,
  insideCampus: false,
  accuracy: null,
  permission: "unknown",
  locating: false,
  submitting: false,
  error: null,
  pending: 0,
  syncing: false
};

/** Per-teacher queue namespace so shared devices never replay another account's attempts. */
function offlineQueueKey(teacherId: string) {
  // Single stable prefix so sign-out and login cleanup can always find it.
  return `attendance_offline_queue:${teacherId}`;
}

async function loadQueue(teacherId?: string): Promise<QueuedAttempt[]> {
  if (!teacherId) return [];
  try {
    const raw = await AsyncStorage.getItem(offlineQueueKey(teacherId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedAttempt =>
        !!item && typeof item === "object" && typeof (item as QueuedAttempt).clientRequestId === "string"
    );
  } catch {
    return [];
  }
}

async function saveQueue(teacherId: string, queue: QueuedAttempt[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      offlineQueueKey(teacherId),
      JSON.stringify(capQueue(queue, OFFLINE_QUEUE_CAP))
    );
  } catch {
    // Queue persistence is best-effort; the in-memory attempt already failed.
  }
}

function deviceInfo() {
  const model = Device.modelName ?? "Unknown device";
  return `${Platform.OS} · ${model}`;
}

export function useAttendanceMarking(teacherId?: string) {
  const [state, setState] = useState<MarkingState>(INITIAL);
  const [requireSelfie, setRequireSelfie] = useState(false);
  const [allowedRadius, setAllowedRadius] = useState(DEFAULT_SETTINGS.geofenceRadiusMeters);
  // School settings fetched from the server; the compiled default is only a
  // fallback until the request lands. The server re-checks every value.
  const geoRef = useRef(DEFAULT_SETTINGS);
  // Ref mirror of `submitting`: state updates are async, so a rapid
  // double-tap would otherwise fire two POSTs before the flag lands.
  const submittingRef = useRef(false);

  const locate = useCallback(async () => {
    // TEMPORARY: the school asked to switch off GPS until further notice.
    // Marking still goes through the authenticated server endpoint.
    if (ATTENDANCE_BYPASS_GPS_AND_TIME) {
      setState((s) => ({
        ...s,
        locating: false,
        permission: "granted",
        distance: 0,
        accuracy: null,
        insideCampus: true,
        error: null
      }));
      return { point: null, accuracy: undefined, isMockLocation: undefined };
    }

    setState((s) => ({ ...s, locating: true, error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((s) => ({
          ...s,
          locating: false,
          permission: "denied",
          error: "Location permission is required to mark attendance."
        }));
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      const distance = getDistanceFromCampus(point, geoRef.current);

      setState((s) => ({
        ...s,
        locating: false,
        permission: "granted",
        distance,
        accuracy: position.coords.accuracy ?? null,
        insideCampus: isInsideCampus(point, geoRef.current)
      }));
      return {
        point,
        accuracy: position.coords.accuracy ?? undefined,
        isMockLocation: typeof position.mocked === "boolean" ? position.mocked : undefined
      };
    } catch {
      setState((s) => ({
        ...s,
        locating: false,
        error: "Couldn’t read your location. Move to an open area and try again."
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  // School-configurable requirement. Fetch once; absence of the config
  // endpoint or a network error keeps the safe default (selfie off).
  useEffect(() => {
    let cancelled = false;
    void getAttendanceConfig()
      .then((config) => {
        if (cancelled) return;
        setRequireSelfie(Boolean(config.requireSelfie));
        geoRef.current = {
          ...DEFAULT_SETTINGS,
          campusLatitude: config.campusLatitude ?? DEFAULT_SETTINGS.campusLatitude,
          campusLongitude: config.campusLongitude ?? DEFAULT_SETTINGS.campusLongitude,
          geofenceRadiusMeters: config.geofenceRadiusMeters ?? DEFAULT_SETTINGS.geofenceRadiusMeters
        };
        setAllowedRadius(geoRef.current.geofenceRadiusMeters);
        // The initial locate() may have used the compiled defaults; refresh
        // with the school's real campus once they are known.
        if (!ATTENDANCE_BYPASS_GPS_AND_TIME) void locate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locate]);

  /**
   * Flush the offline queue FIFO. Items leave only on 2xx or a definitive
   * 4xx (whose reason is reported); a network/retryable failure stops the
   * drain and keeps the remainder queued.
   */
  const drainQueue = useCallback(async () => {
    const queue = await loadQueue(teacherId);
    if (queue.length === 0) {
      setState((s) => (s.pending === 0 && !s.syncing ? s : { ...s, pending: 0, syncing: false }));
      return { synced: 0, rejected: [] as string[] };
    }
    setState((s) => ({ ...s, syncing: true }));
    const remaining: QueuedAttempt[] = [];
    const rejected: string[] = [];
    let stopped = false;
    for (const item of queue) {
      if (stopped) {
        remaining.push(item);
        continue;
      }
      try {
        await postAttendance(item.payload, {
          clientRequestId: item.clientRequestId,
          capturedAt: item.capturedAt
        });
      } catch (err) {
        const status = err instanceof AttendanceSubmitError ? err.status : undefined;
        if (classifySubmitFailure(status) === "definitive") {
          rejected.push(err instanceof Error ? err.message : "Rejected by server.");
          continue;
        }
        remaining.push(item);
        stopped = true;
      }
    }
    if (teacherId) await saveQueue(teacherId, remaining);
    setState((s) => ({
      ...s,
      pending: remaining.length,
      syncing: false,
      error:
        rejected.length > 0
          ? `Queued ${rejected.length === 1 ? "attempt was" : "attempts were"} rejected: ${rejected[0]}`
          : s.error
    }));
    return { synced: queue.length - remaining.length - rejected.length, rejected };
  }, [teacherId]);

  // Initial pending count + retry whenever the app returns to foreground.
  useEffect(() => {
    void loadQueue(teacherId).then((queue) => {
      if (queue.length > 0) setState((s) => ({ ...s, pending: queue.length }));
    });
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void drainQueue();
    });
    return () => subscription.remove();
  }, [drainQueue, teacherId]);

  const retryPending = useCallback(async () => {
    const { synced, rejected } = await drainQueue();
    if (rejected.length > 0) {
      return { ok: false as const, message: `Queued ${rejected.length === 1 ? "attempt was" : "attempts were"} rejected: ${rejected[0]}` };
    }
    return { ok: true as const, message: synced > 0 ? `Synced ${synced} pending ${synced === 1 ? "attempt" : "attempts"}.` : "Nothing pending." };
  }, [drainQueue]);

  const mark = useCallback(
    async (eventType: AttendanceEvent, opts?: { selfieStoragePath?: string }) => {
      if (!teacherId) {
        setState((s) => ({ ...s, error: "Your teacher profile isn’t linked yet. Contact the office." }));
        return { ok: false as const, message: "Teacher profile not linked" };
      }
      if (submittingRef.current) {
        return { ok: false as const, message: "Already submitting — please wait." };
      }
      if (requireSelfie && !opts?.selfieStoragePath) {
        setState((s) => ({ ...s, error: "A selfie is required to mark attendance." }));
        return { ok: false as const, message: "A selfie is required to mark attendance." };
      }
      submittingRef.current = true;

      const fix = ATTENDANCE_BYPASS_GPS_AND_TIME ? null : await locate();
      if (!ATTENDANCE_BYPASS_GPS_AND_TIME && !fix) {
        submittingRef.current = false;
        return { ok: false as const, message: "Location unavailable" };
      }

      const timestamp = new Date().toISOString();
      const payload = {
        teacherId,
        eventType,
        timestamp,
        ...(fix?.point
          ? {
              latitude: fix.point.latitude,
              longitude: fix.point.longitude,
              accuracyMeters: fix.accuracy,
              ...(typeof fix.isMockLocation === "boolean"
                ? { isMockLocation: fix.isMockLocation }
                : {})
            }
          : {}),
        ...(opts?.selfieStoragePath ? { selfieStoragePath: opts.selfieStoragePath } : {}),
        deviceInfo: deviceInfo()
      };

      setState((s) => ({ ...s, submitting: true, error: null }));
      try {
        await postAttendance(payload);
        setState((s) => ({ ...s, submitting: false }));
        // Opportunistic: flush any backlog while we're confirmed online.
        void drainQueue();
        return {
          ok: true as const,
          message: eventType === "checkin" ? "Checked in — have a great day!" : "Checked out · see you tomorrow"
        };
      } catch (err) {
        const status = err instanceof AttendanceSubmitError ? err.status : undefined;
        if (classifySubmitFailure(status) !== "definitive") {
          const queued: QueuedAttempt = {
            clientRequestId: `${teacherId}:${eventType}:${timestamp}`,
            action: eventType,
            capturedAt: timestamp,
            lat: fix?.point?.latitude,
            lng: fix?.point?.longitude,
            accuracy: fix?.accuracy,
            payload
          };
          const queue = capQueue([...(await loadQueue(teacherId)), queued], OFFLINE_QUEUE_CAP);
          await saveQueue(teacherId, queue);
          const message = "No connection — saved. It will sync during the next foreground session. Items older than 2 hours are rejected.";
          setState((s) => ({ ...s, submitting: false, error: message, pending: queue.length }));
          return { ok: false as const, message, queued: true as const };
        }
        const message = err instanceof Error ? err.message : "Attendance failed. Please try again.";
        setState((s) => ({ ...s, submitting: false, error: message }));
        return { ok: false as const, message };
      } finally {
        submittingRef.current = false;
      }
    },
    [drainQueue, locate, requireSelfie, teacherId]
  );

  return {
    ...state,
    pendingCount: state.pending,
    allowedRadius,
    requireSelfie,
    refreshLocation: locate,
    retryPending,
    mark
  };
}
