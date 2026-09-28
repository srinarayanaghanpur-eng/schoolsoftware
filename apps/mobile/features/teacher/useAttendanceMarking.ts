/**
 * Headless GPS attendance flow — the one genuine business path in the mobile
 * app, extracted from the old app/attendance.tsx so no UI owns it.
 *
 * permission → getCurrentPositionAsync → geofence check → POST /api/attendance/mark
 * The server re-validates the geofence; the client check is a fast-fail UX guard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Device from "expo-device";
import {
  DEFAULT_SETTINGS,
  getDistanceFromCampus,
  isInsideCampus
} from "@sri-narayana/shared";
import { postAttendance } from "@/lib/api";

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
};

const INITIAL: MarkingState = {
  distance: null,
  insideCampus: false,
  accuracy: null,
  permission: "unknown",
  locating: false,
  submitting: false,
  error: null
};

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

      setState((s) => ({ ...s, submitting: true, error: null }));
      try {
        await postAttendance({
          teacherId,
          eventType,
          timestamp: new Date().toISOString(),
          latitude: fix.point.latitude,
          longitude: fix.point.longitude,
          accuracyMeters: fix.accuracy,
          deviceInfo: deviceInfo()
        });
        setState((s) => ({ ...s, submitting: false }));
        return {
          ok: true as const,
          message: eventType === "checkin" ? "Checked in — have a great day!" : "Checked out · see you tomorrow"
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Attendance failed. Please try again.";
        setState((s) => ({ ...s, submitting: false, error: message }));
        return { ok: false as const, message };
      } finally {
        submittingRef.current = false;
      }
    },
    [locate, teacherId]
  );

  return {
    ...state,
    allowedRadius: DEFAULT_SETTINGS.geofenceRadiusMeters,
    refreshLocation: locate,
    mark
  };
}
