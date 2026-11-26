import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CommonResolutions,
  VisionCamera,
  useCameraDevice,
  usePhotoOutput
} from "react-native-vision-camera";
import {
  Camera as FaceCamera,
  useImageFaceDetector,
  type Face
} from "react-native-vision-camera-face-detector";
import { Icon } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import type { Image as NitroImage } from "react-native-nitro-image";
import {
  embedFace,
  loadFaceModel,
  matchFace,
  type FaceEmbeddingResult
} from "@/lib/faceRecognition";
import type { FaceGalleryCandidate } from "@/lib/faceApi";
import { useFaceAttendance } from "@/features/teacher/face/useFaceAttendance";
import {
  applyLivenessSample,
  INITIAL_LIVENESS,
  livenessHint,
  livenessPassed,
  livenessScore,
  type LivenessTracker
} from "@/features/teacher/face/faceLiveness";

type Phase = "scanning" | "verifying" | "recognized" | "success";
type MatchState = FaceEmbeddingResult & {
  candidate: FaceGalleryCandidate;
  confidence: number;
};

export function FaceAttendanceScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.HD_4_3,
    containerFormat: "jpeg",
    quality: 0.92,
    qualityPrioritization: "balanced"
  });
  const imageDetector = useImageFaceDetector({
    performanceMode: "accurate",
    runClassifications: false
  });
  const device = useCameraDevice("front");
  const marking = useFaceAttendance();

  const [permission, setPermission] = useState<"checking" | "granted" | "denied">("checking");
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [phase, setPhase] = useState<Phase>("scanning");
  const [faceCount, setFaceCount] = useState(0);
  const [liveness, setLiveness] = useState<LivenessTracker>(INITIAL_LIVENESS);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const livenessRef = useRef<LivenessTracker>(INITIAL_LIVENESS);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requireLiveness =
    marking.gallery?.requireLiveness ?? marking.settings?.requireLiveness ?? true;

  useEffect(() => {
    void VisionCamera.requestCameraPermission().then((granted) => {
      setPermission(granted ? "granted" : "denied");
    }).catch(() => setPermission("denied"));
    void loadFaceModel()
      .then(() => setModelReady(true))
      .catch(() => setError("The face model could not be loaded. Rebuild the app and try again."));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
    });
    return () => {
      subscription.remove();
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const resetScan = useCallback(() => {
    livenessRef.current = INITIAL_LIVENESS;
    setLiveness(INITIAL_LIVENESS);
    setFaceCount(0);
    setMatch(null);
    setMessage(null);
    setError(null);
    setPhase("scanning");
  }, []);

  const onFacesDetected = useCallback((faces: Face[]) => {
    setFaceCount(faces.length);
    if (faces.length !== 1) return;
    const next = applyLivenessSample(livenessRef.current, faces[0]);
    if (next !== livenessRef.current) {
      livenessRef.current = next;
      setLiveness(next);
    }
  }, []);

  const isActive =
    focused &&
    appActive &&
    permission === "granted" &&
    phase === "scanning" &&
    marking.deviceStatus !== "rejected" &&
    marking.deviceStatus !== "revoked";

  const canScan =
    phase === "scanning" &&
    faceCount === 1 &&
    modelReady &&
    !marking.loading &&
    marking.gallery !== null &&
    marking.deviceStatus !== "rejected" &&
    marking.deviceStatus !== "revoked" &&
    (!requireLiveness || livenessPassed(liveness));

  const scan = useCallback(async () => {
    if (!canScan) return;
    setPhase("verifying");
    setError(null);
    setMessage("Checking your face…");
    let image: NitroImage | null = null;
    try {
      const candidates = (marking.gallery?.candidates ?? []).filter(
        (candidate) => candidate.modelVersion === marking.gallery?.modelVersion
      );
      if (candidates.length === 0) {
        throw new Error("No enrolled face uses the current model. Ask the office to re-enroll.");
      }

      const photo = await photoOutput.capturePhoto(
        { flashMode: "off", enableShutterSound: true },
        {}
      );
      try {
        image = await photo.toImageAsync();
      } finally {
        photo.dispose();
      }

      const tempPath = await image.saveToTemporaryFileAsync("jpg", 90);
      const faces = imageDetector.detectFaces(`file://${tempPath}`);
      if (faces.length !== 1) {
        throw new Error(
          faces.length === 0
            ? "No face found in the photo. Move closer and use good light."
            : "More than one face is visible. Only one teacher should stand in front of the camera."
        );
      }

      const embedded = await embedFace(image, faces[0].bounds);
      const found = matchFace(
        embedded.embedding,
        candidates,
        marking.gallery?.matchThreshold ?? 0.6
      );
      if (!found) {
        throw new Error("Face did not match an enrolled teacher. Try again or ask the office to re-enroll.");
      }

      setMatch({
        ...embedded,
        candidate: found.candidate,
        confidence: found.confidence
      });
      setMessage(null);
      setPhase("recognized");
    } catch (err) {
      setPhase("scanning");
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not verify this face.");
    } finally {
      image?.dispose();
    }
  }, [canScan, imageDetector, marking.gallery, modelReady, photoOutput, requireLiveness]);

  const submit = useCallback(
    async (eventType: "checkin" | "checkout") => {
      if (!match) return;
      setError(null);
      const result = await marking.mark(match, eventType, {
        passed: requireLiveness ? livenessPassed(livenessRef.current) : true,
        score: requireLiveness ? livenessScore(livenessRef.current) : 1
      });
      if (result.ok) {
        setPhase("success");
        setMessage(result.message);
        resetTimer.current = setTimeout(resetScan, 4500);
      } else {
        setError(result.message);
        if (!("queued" in result)) setPhase("recognized");
      }
    },
    [marking, match, requireLiveness, resetScan]
  );

  const status = useMemo(() => {
    if (marking.loading) return { text: "Loading face attendance…", tone: t.mute, bg: t.card };
    if (marking.deviceStatus === "approved") {
      return { text: marking.shared ? "Approved kiosk — any teacher can check in" : "This device is approved", tone: t.ok, bg: t.okBg };
    }
    if (marking.deviceStatus === "rejected" || marking.deviceStatus === "revoked") {
      return { text: "This device was not approved. Ask the office.", tone: t.bad, bg: t.badBg };
    }
    return { text: "Waiting for office approval — you can still check in yourself", tone: t.warn, bg: t.warnBg };
  }, [marking.deviceStatus, marking.loading, marking.shared, t]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: t.card, borderColor: t.line }]}
        >
          <Icon name="arrow-back" size={21} tint={t.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: t.ink }]}>Face attendance</Text>
          <Text style={[styles.subtitle, { color: t.mute }]}>Look at the camera</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <View style={[styles.dot, { backgroundColor: status.tone }]} />
          <Text numberOfLines={1} style={[styles.statusText, { color: status.tone }]}>
            {marking.deviceStatus === "approved"
              ? "Approved"
              : marking.deviceStatus === "unregistered"
                ? "Checking"
                : marking.deviceStatus === "pending"
                  ? "Pending"
                  : "Blocked"}
          </Text>
        </View>
      </View>

      <View style={styles.cameraWrap}>
        <View style={styles.cameraFrame}>
          {permission === "denied" ? (
            <View style={styles.centerFill}>
              <Icon name="no-photography" size={34} tint={t.bad} />
              <Text style={[styles.permissionTitle, { color: t.ink }]}>Camera permission is off</Text>
              <Text style={[styles.permissionText, { color: t.mute }]}>
                Face attendance needs the front camera.
              </Text>
              <Pressable
                onPress={() => void Linking.openSettings()}
                style={[styles.textButton, { borderColor: t.blue }]}
              >
                <Text style={{ color: t.blue, fontWeight: "700" }}>Open settings</Text>
              </Pressable>
            </View>
          ) : !device ? (
            <View style={styles.centerFill}>
              <ActivityIndicator color={t.blue} />
              <Text style={[styles.permissionText, { color: t.mute }]}>Starting the front camera…</Text>
            </View>
          ) : (
            <FaceCamera
              device={device}
              isActive={isActive}
              mirrorMode="off"
              resizeMode="cover"
              performanceMode="fast"
              runClassifications
              outputResolution="preview"
              onFacesDetected={onFacesDetected}
              onError={(err) => setError(err.message)}
              outputs={[photoOutput]}
              style={StyleSheet.absoluteFill}
            />
          )}

          <View pointerEvents="none" style={styles.overlay}>
            <View style={[styles.guide, { borderColor: faceCount === 1 ? t.ok : "rgba(255,255,255,0.72)" }]} />
            <View style={styles.cameraTop}>
              <Text style={styles.cameraHint}>
                {faceCount === 0
                  ? "Move your face inside the oval"
                  : faceCount > 1
                    ? "Only one person should be visible"
                    : requireLiveness && !livenessPassed(liveness)
                      ? livenessHint(liveness)
                      : "Face is ready"}
              </Text>
            </View>
            {phase === "verifying" ? (
              <View style={styles.processing}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.processingText}>{message ?? "Checking…"}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.line, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {marking.loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={t.blue} />
            <Text style={{ color: t.mute }}>Loading face profiles…</Text>
          </View>
        ) : phase === "recognized" || phase === "success" ? (
          <View style={{ gap: space.md }}>
            <View style={styles.matchRow}>
              <View style={[styles.avatar, { backgroundColor: t.tint }]}>
                <Icon name="face" size={28} tint={t.blue} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.matchName, { color: t.ink }]} numberOfLines={1}>
                  {match?.candidate.fullName ?? "Teacher"}
                </Text>
                <Text style={{ color: t.mute }}>
                  {match ? `Match ${Math.round(match.confidence * 100)}%` : ""}
                </Text>
              </View>
              <Icon name="verified" size={24} tint={t.ok} />
            </View>
            {message ? (
              <Text style={{ color: t.ok, fontWeight: "700" }}>{message}</Text>
            ) : null}
            {error ? <Text style={{ color: t.bad }}>{error}</Text> : null}
            {phase === "recognized" ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void submit("checkin")}
                  style={[styles.actionButton, { backgroundColor: t.blue }]}
                >
                  <Icon name="login" size={20} tint="#FFFFFF" />
                  <Text style={styles.actionText}>Check in</Text>
                </Pressable>
                <Pressable
                  onPress={() => void submit("checkout")}
                  style={[styles.actionButton, { backgroundColor: t.ok }]}
                >
                  <Icon name="logout" size={20} tint="#FFFFFF" />
                  <Text style={styles.actionText}>Check out</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={resetScan} style={[styles.actionButton, { backgroundColor: t.blue }]}>
                <Icon name="face" size={20} tint="#FFFFFF" />
                <Text style={styles.actionText}>Scan next teacher</Text>
              </Pressable>
            )}
            <Pressable onPress={resetScan} style={styles.linkButton}>
              <Text style={{ color: t.mute, fontWeight: "600" }}>Scan again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
              <View style={[styles.dot, { backgroundColor: status.tone }]} />
              <Text style={{ color: status.tone, flex: 1, fontWeight: "600" }}>{status.text}</Text>
            </View>

            {requireLiveness ? (
              <View style={styles.steps}>
                <Step done={liveness.blinkPassed} label="Blink once" tint={t} />
                <Step done={liveness.turnPassed} label="Turn left, then right" tint={t} />
                <Step done={faceCount === 1} label="One face in frame" tint={t} />
              </View>
            ) : (
              <Text style={{ color: t.mute }}>Center one face in the oval, then verify.</Text>
            )}

            {error ? <Text style={{ color: t.bad, fontWeight: "600" }}>{error}</Text> : null}
            {marking.error ? <Text style={{ color: t.bad, fontWeight: "600" }}>{marking.error}</Text> : null}

            <Pressable
              onPress={() => void scan()}
              disabled={!canScan}
              style={[
                styles.verifyButton,
                { backgroundColor: canScan ? t.blue : t.line }
              ]}
            >
              {!modelReady ? (
                <ActivityIndicator color={canScan ? "#FFFFFF" : t.mute} />
              ) : (
                <Icon name="face" size={22} tint={canScan ? "#FFFFFF" : t.mute} />
              )}
              <Text style={[styles.verifyText, { color: canScan ? "#FFFFFF" : t.mute }]}>
                {!modelReady ? "Loading model…" : "Verify face"}
              </Text>
            </Pressable>

            {marking.pending > 0 ? (
              <Pressable
                onPress={() => void marking.retryPending()}
                disabled={marking.syncing}
                style={styles.linkButton}
              >
                <Text style={{ color: t.blue, fontWeight: "700" }}>
                  {marking.syncing ? "Syncing…" : `Sync ${marking.pending} pending ${marking.pending === 1 ? "attempt" : "attempts"}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function Step({
  done,
  label,
  tint
}: {
  done: boolean;
  label: string;
  tint: ReturnType<typeof useTheme>["t"];
}) {
  return (
    <View style={styles.step}>
      <Icon
        name={done ? "check-circle" : "radio-button-unchecked"}
        size={18}
        tint={done ? tint.ok : tint.faint}
      />
      <Text style={{ color: done ? tint.ok : tint.mute, fontWeight: done ? "700" : "500" }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 1 },
  statusPill: {
    maxWidth: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  cameraWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  cameraFrame: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#090B14"
  },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  permissionTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  permissionText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  textButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  cameraTop: { position: "absolute", top: 16, left: 16, right: 16, alignItems: "center" },
  cameraHint: {
    color: "#FFFFFF",
    backgroundColor: "rgba(9,11,20,0.58)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden"
  },
  guide: {
    width: "66%",
    aspectRatio: 0.76,
    borderRadius: 999,
    borderWidth: 2.5,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  processing: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "44%",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(9,11,20,0.68)",
    borderRadius: radius.md,
    padding: 18
  },
  processingText: { color: "#FFFFFF", fontWeight: "600", textAlign: "center" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: space.md
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, padding: 10 },
  steps: { gap: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyButton: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  verifyText: { fontSize: 16, fontWeight: "800" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  matchName: { fontSize: 18, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  actionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  linkButton: { alignItems: "center", paddingVertical: 8 }
});
