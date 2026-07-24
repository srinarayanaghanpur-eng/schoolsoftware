<#
    mobile-ui-teardown.ps1
    ----------------------
    Deletes the entire mobile presentation layer (apps/mobile/app + components +
    UI shell + dead optimization infra), preserving all business logic.

    Order of operations is deliberate:
      1. Back up apps/mobile to a timestamped folder (safety net)
      2. EXTRACT logic that is currently trapped inside UI files
      3. DELETE the presentation layer

    Nothing in packages/shared is touched. Nothing in lib/ is deleted except the
    four files that are either UI shell or verified-dead Firestore infrastructure.

    Usage (from repo root):
        powershell -ExecutionPolicy Bypass -File scripts\mobile-ui-teardown.ps1
    Dry run (shows what would happen, changes nothing):
        powershell -ExecutionPolicy Bypass -File scripts\mobile-ui-teardown.ps1 -DryRun
#>

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobile   = Join-Path $repoRoot "apps\mobile"

if (-not (Test-Path $mobile)) { throw "apps\mobile not found at $mobile. Run this from the repo root." }

function Say($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }
function Remove-One($relPath) {
    $full = Join-Path $mobile $relPath
    if (-not (Test-Path $full)) { Say "  skip (absent)  $relPath" "DarkGray"; return }
    if ($DryRun) { Say "  WOULD DELETE   $relPath" "Yellow"; return }
    Remove-Item -LiteralPath $full -Force
    Say "  deleted        $relPath" "DarkRed"
}
function Write-One($relPath, $content) {
    $full = Join-Path $mobile $relPath
    $dir  = Split-Path -Parent $full
    if ($DryRun) { Say "  WOULD CREATE   $relPath" "Yellow"; return }
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -LiteralPath $full -Value $content -Encoding UTF8
    Say "  created        $relPath" "Green"
}

# ---------------------------------------------------------------- 1. BACKUP
Say ""
Say "=== STEP 1: Backup ===" "Cyan"
$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $repoRoot ("_mobile-backup-" + $stamp)
if ($DryRun) {
    Say "  WOULD BACK UP apps\mobile -> $backup" "Yellow"
} else {
    Copy-Item -Path $mobile -Destination $backup -Recurse -Force
    Say "  backed up to $backup" "Green"
    Say "  (delete this folder once the rebuild is underway)" "DarkGray"
}

# --------------------------------------------------------------- 2. EXTRACT
Say ""
Say "=== STEP 2: Extract logic trapped in UI files ===" "Cyan"

# 2a. Role routing — rescued from lib/mobileTheme.ts before it is deleted.
#     Routing logic only. The palette and workspace theming are NOT carried over;
#     the new design system owns all colour.
Write-One "lib\roleRouting.ts" @'
import type { Role } from "@sri-narayana/shared";

/**
 * Role -> workspace -> landing route.
 *
 * Extracted from the deleted lib/mobileTheme.ts during the 2026-07-21 UI
 * teardown. This file intentionally contains NO styling: the old palette and
 * themeForRole() were presentation concerns and were dropped. Colour now lives
 * exclusively in design-system/tokens.
 */
export type WorkspaceKind =
  | "teacher"
  | "parent"
  | "admin"
  | "principal"
  | "accountant"
  | "desktop";

export function workspaceForRole(role?: Role): WorkspaceKind {
  if (role === "parent") return "parent";
  if (role === "accountant") return "accountant";
  if (role === "principal") return "principal";
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "settings_manager") return "desktop";
  return "teacher";
}

export const WORKSPACE_LABELS: Record<WorkspaceKind, string> = {
  teacher: "Teacher",
  parent: "Parent",
  admin: "Admin",
  principal: "Principal",
  accountant: "Accountant",
  desktop: "Desktop only"
};

export function dashboardPathForRole(role?: Role): string {
  const workspace = workspaceForRole(role);
  // Principal shares the Admin home screen, which adapts its copy by role.
  if (workspace === "admin" || workspace === "principal") return "/admin";
  if (workspace === "accountant") return "/accountant";
  if (workspace === "parent") return "/parent";
  if (workspace === "desktop") return "/profile";
  return "/home";
}
'@

# 2b. App bootstrap — rescued from lib/OptimizedAppLayout.tsx.
#     The background-sync init survives; the SafeAreaView/StatusBar shell does not.
Write-One "lib\appBootstrap.ts" @'
import { useEffect } from "react";
import { mobileBackgroundSync, initializeMobileBackgroundSync } from "./backgroundSync";
import { mobilePerformanceMonitor } from "./performanceMonitor";

/**
 * Boots background sync + performance instrumentation.
 *
 * Extracted from the deleted lib/OptimizedAppLayout.tsx during the 2026-07-21
 * UI teardown. The old component also rendered a SafeAreaView/StatusBar shell
 * with hardcoded colours and a competing inset strategy; that shell was dropped.
 * The new design-system AppShell owns layout, and the root _layout.tsx must
 * mount SafeAreaProvider (which the old app never did).
 *
 * Call once, from the root layout.
 */
export function useAppBootstrap() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const init = async () => {
      mobilePerformanceMonitor.startMeasure("app-initialization");
      try {
        cleanup = await initializeMobileBackgroundSync();
        mobilePerformanceMonitor.endMeasure("app-initialization");
      } catch (error) {
        console.error("[AppBootstrap] Initialization failed:", error);
      }
    };

    void init();

    return () => {
      cleanup?.();
      mobileBackgroundSync.clearTasks();
    };
  }, []);
}
'@

# 2c. Attendance marking — the ONLY real business flow in the mobile app.
#     Rescued from app/attendance.tsx as a headless hook. Zero UI.
Write-One "lib\attendance\useAttendanceMarking.ts" @'
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { doc, getDoc } from "firebase/firestore";
import {
  DEFAULT_SETTINGS,
  getDistanceFromCampus,
  isInsideCampus,
  type SchoolSettings
} from "@sri-narayana/shared";
import { db } from "@/lib/firebase";
import { postAttendance } from "@/lib/api";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";

export type AttendanceEvent = "checkin" | "checkout";

export type MarkResult =
  | { ok: true; event: AttendanceEvent }
  | { ok: false; error: string };

/**
 * Headless GPS attendance marking.
 *
 * Extracted verbatim (logic-wise) from the deleted app/attendance.tsx during the
 * 2026-07-21 UI teardown. This was the only genuinely wired feature in the old
 * mobile app, so the flow is preserved exactly:
 *
 *   request foreground permission
 *     -> getCurrentPositionAsync (high accuracy)
 *     -> getDistanceFromCampus / isInsideCampus  (packages/shared)
 *     -> POST /api/attendance/mark               (lib/api, bearer token)
 *
 * Differences from the old screen: it returns a MarkResult instead of firing
 * Alert.alert, so the new UI can surface a Snackbar. Teacher-level GPS overrides
 * and the gpsEnabled===false bypass are unchanged.
 *
 * TODO (Phase 2): settings are read straight from Firestore here, inherited from
 * the old screen. Move behind lib/api once the settings endpoint exists.
 */
export function useAttendanceMarking() {
  const { teacher, loading: teacherLoading, error: teacherError } = useTeacherAttendanceData();
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [distance, setDistance] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState<AttendanceEvent | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "school"))
      .then((snapshot) => {
        if (snapshot.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snapshot.data() });
      })
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  // Teacher-level GPS overrides win over school defaults.
  const effectiveSettings = useMemo<SchoolSettings>(() => ({
    ...settings,
    campusLatitude: teacher?.gpsLatitude ?? settings.campusLatitude,
    campusLongitude: teacher?.gpsLongitude ?? settings.campusLongitude,
    geofenceRadiusMeters: teacher?.gpsRadiusMeters ?? settings.geofenceRadiusMeters
  }), [settings, teacher]);

  const gpsRequired = teacher?.gpsEnabled !== false;

  const mark = useCallback(async (eventType: AttendanceEvent): Promise<MarkResult> => {
    setBusy(eventType);
    try {
      if (!teacher) throw new Error("Teacher profile is still loading. Please try again in a moment.");

      let point: { latitude: number; longitude: number; accuracyMeters?: number } | undefined;

      if (gpsRequired) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          throw new Error("Location permission is required for attendance.");
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        point = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracyMeters: location.coords.accuracy ?? undefined
        };
        setCoords({ latitude: point.latitude, longitude: point.longitude });
        setDistance(getDistanceFromCampus(point, effectiveSettings));

        if (!isInsideCampus(point, effectiveSettings)) {
          throw new Error("You are outside campus. Attendance not allowed.");
        }
      } else {
        setCoords(null);
        setDistance(null);
      }

      await postAttendance({
        teacherId: teacher.id,
        eventType,
        timestamp: new Date().toISOString(),
        latitude: point?.latitude,
        longitude: point?.longitude,
        accuracyMeters: point?.accuracyMeters,
        deviceInfo: `${Device.manufacturer ?? "Unknown"} ${Device.modelName ?? "Device"}`
      });

      return { ok: true, event: eventType };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to mark attendance." };
    } finally {
      setBusy(null);
    }
  }, [teacher, gpsRequired, effectiveSettings]);

  return {
    mark,
    busy,
    distance,
    coords,
    locationKnown: coords !== null,
    insideCampus: distance !== null && distance <= effectiveSettings.geofenceRadiusMeters,
    gpsRequired,
    settings: effectiveSettings,
    teacher,
    loading: teacherLoading,
    error: teacherError
  };
}
'@

# ---------------------------------------------------------------- 3. DELETE
Say ""
Say "=== STEP 3: Delete presentation layer ===" "Cyan"

Say ""
Say "-- screens (app/) --" "White"
# NOTE (2026-07-21): _layout.tsx, index.tsx and login.tsx are NOT deleted —
# they were already rebuilt in place on the new design system alongside the
# parent workspace (app/parent/). Only the remaining old screens go.
@(
    "app\home.tsx",
    "app\admin.tsx", "app\parent.tsx", "app\accountant.tsx", "app\profile.tsx",
    "app\people.tsx", "app\messages.tsx", "app\attendance.tsx", "app\calendar.tsx",
    "app\history.tsx", "app\fees.tsx", "app\payments.tsx", "app\reports.tsx"
) | ForEach-Object { Remove-One $_ }

Say ""
Say "-- components/ --" "White"
@(
    "components\Screen.tsx", "components\Card.tsx", "components\StatusPill.tsx",
    "components\AnimatedEntrance.tsx", "components\OfflineStatusIndicator.tsx"
) | ForEach-Object { Remove-One $_ }

Say ""
Say "-- UI shell + dead Firestore infrastructure --" "White"
@(
    "lib\OptimizedAppLayout.tsx",        # UI shell; logic saved to lib/appBootstrap.ts
    "lib\mobileTheme.ts",                # palette; routing saved to lib/roleRouting.ts
    "lib\lazyLoad.ts",                   # dead: no screen imports it
    "lib\firebaseQueryOptimization.ts"   # dead: only lazyLoad imported it
) | ForEach-Object { Remove-One $_ }

# ---------------------------------------------------------------- SUMMARY
Say ""
Say "=== Done ===" "Cyan"
if ($DryRun) {
    Say "Dry run only - nothing was changed." "Yellow"
} else {
    Say "Deleted 25 UI files. Created 3 extracted logic files." "Green"
    Say "Backup: $backup" "DarkGray"
}
Say ""
Say "PRESERVED: firebase.ts, authStorage.ts, api.ts, mobileSession.tsx," "Gray"
Say "           backgroundSync.ts, cache/, performanceMonitor.ts," "Gray"
Say "           requestOptimization.ts, hooks/, useTeacherAttendanceData.ts," "Gray"
Say "           types/, and all of packages/shared." "Gray"
Say ""
Say "EXPECTED: the app now boots straight into the rebuilt UI:" "Yellow"
Say "          / -> login or /parent (parent workspace, live data)." "Yellow"
Say "          Other roles see a 'use the web portal' message until their" "Yellow"
Say "          workspaces are rebuilt in later phases." "Yellow"
Say ""
Say "NEXT: 1. (Done 2026-07-21) usePerformance.ts was already pruned of its" "Gray"
Say "         lazyLoad imports; no further compile fixes expected." "Gray"
Say "      2. cd apps/mobile && npx tsc --noEmit  to verify." "Gray"
Say "      3. Set EXPO_PUBLIC_WEB_API_URL, then npm run dev:mobile." "Gray"
Say ""
