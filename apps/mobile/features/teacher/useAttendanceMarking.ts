/**
 * Headless GPS attendance flow — the one genuine business path in the mobile
 * app, extracted from the old app/attendance.tsx so no UI owns it.
 *
 * permission → getCurrentPositionAsync → geofence check → POST /api/attendance/mark
 * The server re-validates the geofence; the client check is a fast-fail UX guard.
 */
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Device from "expo-device";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared/constants";
import {
  getDistanceFromCampus,
  isInsideCampus
} from "@sri-narayana/shared/services/attendance";
import { postAttendance } from "@/lib/api";

export type AttendanceEvent = "check_in" | "check_out";

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

      const fix = await locate();
      if (!fix) return { ok: false as const, message: "Location unavailable" };

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
          message: eventType === "check_in" ? "Checked in — have a great day!" : "Checked out · see you tomorrow"
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Attendance failed. Please try again.";
        setState((s) => ({ ...s, submitting: false, error: message }));
        return { ok: false as const, message };
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
