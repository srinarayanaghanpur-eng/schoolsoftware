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
  DEFAULT_SETTINGS,
  getDistanceFromCampus,
  isInsideCampus
} from "@sri-narayana/shared";
import { AttendanceSubmitError, postAttendance } from "@/lib/api";
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

const OFFLINE_QUEUE_KEY = "@attendance_offline_queue";

async function loadQueue(): Promise<QueuedAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
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

async function saveQueue(queue: QueuedAttempt[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(capQueue(queue, OFFLINE_QUEUE_CAP)));
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
  // Ref mirror of `submitting`: state updates are async, so a rapid
  // double-tap would otherwise fire two POSTs before the flag lands.
  const submittingRef = useRef(false);

  const locate = useCallback(async () => {
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
      const distance = getDistanceFromCampus(point, DEFAULT_SETTINGS);

      setState((s) => ({
        ...s,
        locating: false,
        permission: "granted",
        distance,
        accuracy: position.coords.accuracy ?? null,
        insideCampus: isInsideCampus(point, DEFAULT_SETTINGS)
      }));
      return { point, accuracy: position.coords.accuracy ?? undefined };
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

  /**
   * Flush the offline queue FIFO. Items leave only on 2xx or a definitive
   * 4xx (whose reason is reported); a network/retryable failure stops the
   * drain and keeps the remainder queued.
   */
  const drainQueue = useCallback(async () => {
    const queue = await loadQueue();
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
    await saveQueue(remaining);
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
  }, []);

  // Initial pending count + retry whenever the app returns to foreground.
  useEffect(() => {
    void loadQueue().then((queue) => {
      if (queue.length > 0) setState((s) => ({ ...s, pending: queue.length }));
    });
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void drainQueue();
    });
    return () => subscription.remove();
  }, [drainQueue]);

  const retryPending = useCallback(async () => {
    const { synced, rejected } = await drainQueue();
    if (rejected.length > 0) {
      return { ok: false as const, message: `Queued ${rejected.length === 1 ? "attempt was" : "attempts were"} rejected: ${rejected[0]}` };
    }
    return { ok: true as const, message: synced > 0 ? `Synced ${synced} pending ${synced === 1 ? "attempt" : "attempts"}.` : "Nothing pending." };
  }, [drainQueue]);

  const mark = useCallback(
    async (eventType: AttendanceEvent) => {
      if (!teacherId) {
        setState((s) => ({ ...s, error: "Your teacher profile isn’t linked yet. Contact the office." }));
        return { ok: false as const, message: "Teacher profile not linked" };
      }
      if (submittingRef.current) {
        return { ok: false as const, message: "Already submitting — please wait." };
      }
      submittingRef.current = true;

      const fix = await locate();
      if (!fix) {
        submittingRef.current = false;
        return { ok: false as const, message: "Location unavailable" };
      }

      const payload = {
        teacherId,
        eventType,
        timestamp: new Date().toISOString(),
        latitude: fix.point.latitude,
        longitude: fix.point.longitude,
        accuracyMeters: fix.accuracy,
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
            clientRequestId: newUuid(),
            action: eventType,
            capturedAt: new Date().toISOString(),
            lat: fix.point.latitude,
            lng: fix.point.longitude,
            accuracy: fix.accuracy,
            payload
          };
          const queue = capQueue([...(await loadQueue()), queued], OFFLINE_QUEUE_CAP);
          await saveQueue(queue);
          const message = "No connection — saved. It will sync automatically.";
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
    [drainQueue, locate, teacherId]
  );

  return {
    ...state,
    pendingCount: state.pending,
    allowedRadius: DEFAULT_SETTINGS.geofenceRadiusMeters,
    refreshLocation: locate,
    retryPending,
    mark
  };
}
