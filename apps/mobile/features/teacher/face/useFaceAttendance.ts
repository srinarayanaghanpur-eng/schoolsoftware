import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
import {
  ATTENDANCE_BYPASS_GPS_AND_TIME,
  type FaceAttendanceSettings
} from "@sri-narayana/shared";
import {
  AttendanceSubmitError
} from "@/lib/api";
import {
  getFaceAttendanceSettings,
  getFaceGallery,
  postFaceAttendance,
  registerFaceDevice,
  type FaceGallery,
  type FaceGalleryCandidate
} from "@/lib/faceApi";
import {
  getFaceAppVersion,
  getFaceDeviceId,
  getFaceDeviceName
} from "@/lib/faceDevice";
import {
  readCachedFaceGallery,
  writeCachedFaceGallery
} from "@/lib/faceGalleryCache";
import {
  buildQueuedPayload,
  capQueue,
  classifySubmitFailure,
  OFFLINE_QUEUE_CAP,
  type QueuedAttempt
} from "@/lib/offlineQueue";
import { useMobileSession } from "@/lib/mobileSession";

export type FaceMatchResult = {
  candidate: FaceGalleryCandidate;
  confidence: number;
  embedding: number[];
  quality: number;
};

type FaceState = {
  settings: FaceAttendanceSettings | null;
  deviceStatus: FaceGallery["deviceStatus"] | "unregistered";
  shared: boolean;
  gallery: FaceGallery | null;
  loading: boolean;
  pending: number;
  syncing: boolean;
  error: string | null;
};

const INITIAL: FaceState = {
  settings: null,
  deviceStatus: "unregistered",
  shared: false,
  gallery: null,
  loading: true,
  pending: 0,
  syncing: false,
  error: null
};

function queueKey(ownerId: string) {
  return `face_attendance_offline_queue:${ownerId}`;
}

async function loadQueue(ownerId?: string): Promise<QueuedAttempt[]> {
  if (!ownerId) return [];
  try {
    const raw = await AsyncStorage.getItem(queueKey(ownerId));
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

async function saveQueue(ownerId: string, queue: QueuedAttempt[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      queueKey(ownerId),
      JSON.stringify(capQueue(queue, OFFLINE_QUEUE_CAP))
    );
  } catch {
    // Best-effort.
  }
}

function deviceInfo() {
  return `${Platform.OS} · ${Device.modelName ?? "Unknown device"}`;
}

export function useFaceAttendance() {
  const { user } = useMobileSession();
  const ownerId = user?.uid;
  const [state, setState] = useState<FaceState>(INITIAL);
  const submittingRef = useRef(false);
  const galleryRef = useRef<FaceGallery | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    let cached: FaceGallery | null = null;
    try {
      const deviceId = await getFaceDeviceId();
      cached = await readCachedFaceGallery(deviceId);
      const settings = await getFaceAttendanceSettings();
      if (!settings.enabled) {
        setState((current) => ({
          ...current,
          settings,
          loading: false,
          error: "Face attendance is switched off by the school office."
        }));
        return;
      }

      const device = await registerFaceDevice({
        deviceId,
        name: getFaceDeviceName(),
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: getFaceAppVersion()
      });

      let gallery: FaceGallery;
      try {
        gallery = await getFaceGallery(deviceId);
        await writeCachedFaceGallery(deviceId, gallery);
      } catch (error) {
        if (!cached) throw error;
        gallery = cached;
      }
      galleryRef.current = gallery;
      setState((current) => ({
        ...current,
        settings,
        deviceStatus: gallery.deviceStatus ?? device.status,
        shared: gallery.shared,
        gallery,
        loading: false,
        error:
          gallery.candidates.length === 0
            ? "No teacher face profiles are available on this device yet."
            : null
      }));
    } catch (error) {
      const fallback = cached;
      if (fallback && fallback.enabled && fallback.candidates.length > 0) {
        galleryRef.current = fallback;
        setState((current) => ({
          ...current,
          gallery: fallback,
          deviceStatus: fallback.deviceStatus,
          shared: fallback.shared,
          loading: false,
          error: "Offline — using saved face profiles. Attendance will sync when back online."
        }));
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to start face attendance."
      }));
    }
  }, []);

  useEffect(() => {
    void load();
    // The pending count is separate from the live config fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drainQueue = useCallback(async () => {
    const queue = await loadQueue(ownerId);
    if (queue.length === 0) {
      setState((current) =>
        current.pending === 0 && !current.syncing
          ? current
          : { ...current, pending: 0, syncing: false }
      );
      return { synced: 0, rejected: [] as string[] };
    }

    setState((current) => ({ ...current, syncing: true }));
    const remaining: QueuedAttempt[] = [];
    const rejected: string[] = [];
    let stopped = false;

    for (const item of queue) {
      if (stopped) {
        remaining.push(item);
        continue;
      }
      try {
        await postFaceAttendance(buildQueuedPayload(item), {
          clientRequestId: item.clientRequestId,
          capturedAt: item.capturedAt
        });
      } catch (error) {
        const status = error instanceof AttendanceSubmitError ? error.status : undefined;
        if (classifySubmitFailure(status) === "definitive") {
          rejected.push(error instanceof Error ? error.message : "Rejected by server.");
          continue;
        }
        remaining.push(item);
        stopped = true;
      }
    }

    if (ownerId) await saveQueue(ownerId, remaining);
    setState((current) => ({
      ...current,
      pending: remaining.length,
      syncing: false,
      error:
        rejected.length > 0
          ? `Queued face ${rejected.length === 1 ? "attempt was" : "attempts were"} rejected: ${rejected[0]}`
          : current.error
    }));
    return { synced: queue.length - remaining.length - rejected.length, rejected };
  }, [ownerId]);

  useEffect(() => {
    void loadQueue(ownerId).then((queue) => {
      if (queue.length > 0) setState((current) => ({ ...current, pending: queue.length }));
    });
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void drainQueue();
    });
    return () => subscription.remove();
  }, [drainQueue, ownerId]);

  const retryPending = useCallback(async () => {
    const result = await drainQueue();
    if (result.rejected.length > 0) {
      return { ok: false as const, message: result.rejected[0] };
    }
    return {
      ok: true as const,
      message:
        result.synced > 0
          ? `Synced ${result.synced} face ${result.synced === 1 ? "attempt" : "attempts"}.`
          : "Nothing pending."
    };
  }, [drainQueue]);

  const getFix = useCallback(async () => {
    if (ATTENDANCE_BYPASS_GPS_AND_TIME) return { ok: true as const, fix: null };
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return { ok: false as const, message: "Location permission is required for face attendance." };
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      return {
        ok: true as const,
        fix: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? undefined,
          isMockLocation:
            typeof position.mocked === "boolean" ? position.mocked : undefined
        }
      };
    } catch {
      return { ok: false as const, message: "Could not read your location. Move to an open area and try again." };
    }
  }, []);

  const mark = useCallback(
    async (
      match: FaceMatchResult,
      eventType: "checkin" | "checkout",
      liveness: { passed: boolean; score: number }
    ) => {
      if (submittingRef.current) {
        return { ok: false as const, message: "Already submitting — please wait." };
      }
      const gallery = galleryRef.current;
      if (!gallery) {
        return { ok: false as const, message: "Face profiles are not loaded yet." };
      }
      const fixResult = await getFix();
      if (!fixResult.ok) return { ok: false as const, message: fixResult.message };

      submittingRef.current = true;
      setState((current) => ({ ...current, error: null }));
      const timestamp = new Date().toISOString();
      const payload: Record<string, unknown> = {
        teacherId: match.candidate.teacherId,
        eventType,
        timestamp,
        observedEmbedding: match.embedding,
        modelVersion: gallery.modelVersion,
        matchConfidence: match.confidence,
        livenessPassed: liveness.passed,
        livenessScore: liveness.score,
        deviceId: await getFaceDeviceId(),
        deviceInfo: deviceInfo(),
        ...(fixResult.fix
          ? {
              latitude: fixResult.fix.latitude,
              longitude: fixResult.fix.longitude,
              accuracyMeters: fixResult.fix.accuracyMeters,
              ...(typeof fixResult.fix.isMockLocation === "boolean"
                ? { isMockLocation: fixResult.fix.isMockLocation }
                : {})
            }
          : {})
      };

      try {
        await postFaceAttendance(payload);
        setState((current) => ({ ...current, error: null }));
        void drainQueue();
        return {
          ok: true as const,
          message:
            eventType === "checkin"
              ? `Checked in — ${match.candidate.fullName}`
              : `Checked out — ${match.candidate.fullName}`
        };
      } catch (error) {
        const status = error instanceof AttendanceSubmitError ? error.status : undefined;
        if (classifySubmitFailure(status) !== "definitive" && ownerId) {
          const queued: QueuedAttempt = {
            clientRequestId: `${match.candidate.teacherId}:${eventType}:${timestamp}`,
            action: eventType,
            capturedAt: timestamp,
            payload
          };
          const queue = capQueue([...(await loadQueue(ownerId)), queued], OFFLINE_QUEUE_CAP);
          await saveQueue(ownerId, queue);
          setState((current) => ({
            ...current,
            pending: queue.length,
            error: "No connection — saved. It will sync when the app is back online."
          }));
          return {
            ok: false as const,
            queued: true as const,
            message: "No connection — saved for automatic sync."
          };
        }
        const message = error instanceof Error ? error.message : "Face attendance failed.";
        setState((current) => ({ ...current, error: message }));
        return { ok: false as const, message };
      } finally {
        submittingRef.current = false;
      }
    },
    [drainQueue, getFix, ownerId]
  );

  return {
    ...state,
    teacherId: undefined,
    reload: load,
    mark,
    retryPending
  };
}
