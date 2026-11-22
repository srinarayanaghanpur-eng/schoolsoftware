/**
 * Driver face-attendance demo.
 *
 * Uses the existing expo-camera module to capture a front-camera frame and
 * plays a verification animation. The production version should send the
 * frame to the existing attendance endpoint / face-match service and only
 * mark attendance after the server confirms the driver.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Card, DSText, Icon, PillButton, PressableScale } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";

export function FaceCheckModal({
  visible,
  onClose,
  onVerified
}: {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { t } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = useRef(new Animated.Value(0)).current;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setScanning(false);
    setSuccess(false);
    setError(null);
  }, [visible]);

  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, scan]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  if (!visible) return null;

  const capture = async () => {
    if (busy || success) return;
    if (!permission?.granted) {
      setError("Allow camera access before scanning your face.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cameraRef.current?.takePictureAsync({ quality: 0.4 });
      setScanning(true);
      const verifyTimer = setTimeout(() => {
        setScanning(false);
        setSuccess(true);
        setBusy(false);
        const doneTimer = setTimeout(() => {
          onVerified();
          onClose();
        }, 850);
        timers.current.push(doneTimer);
      }, 1600);
      timers.current.push(verifyTimer);
    } catch {
      setBusy(false);
      setError("Could not capture your face. Hold the phone steady and try again.");
    }
  };

  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [8, 252] });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.72)",
          justifyContent: "center",
          padding: space.lg
        }}
      >
        <Card style={{ gap: space.md, padding: space.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <DSText variant="title">Face attendance</DSText>
              <DSText variant="label">Look at the camera and hold still</DSText>
            </View>
            <PressableScale accessibilityLabel="Close" onPress={onClose}>
              <Icon name="close" size={23} tint={t.mute} />
            </PressableScale>
          </View>

          <View
            style={{
              height: 300,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: t.ink,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {permission?.granted ? (
              <>
                <CameraView ref={cameraRef} facing="front" style={{ flex: 1, width: "100%" }} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: 210,
                    height: 270,
                    borderRadius: 120,
                    borderWidth: 2,
                    borderColor: success ? t.ok : "rgba(255,255,255,0.9)"
                  }}
                />
                {scanning ? (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 40,
                      right: 40,
                      height: 2,
                      backgroundColor: t.ok,
                      transform: [{ translateY: scanY }]
                    }}
                  />
                ) : null}
                {success ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <View
                      style={{
                        width: 66,
                        height: 66,
                        borderRadius: 33,
                        backgroundColor: t.ok,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Icon name="check" size={38} tint={t.card} />
                    </View>
                    <DSText variant="title" tint={t.card}>Face matched</DSText>
                    <DSText variant="label" tint="rgba(255,255,255,0.82)">Demo confidence 98.4%</DSText>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{ alignItems: "center", gap: space.md, padding: space.xl }}>
                <Icon name="no-photography" size={42} tint={t.card} />
                <DSText variant="bodyMedium" tint={t.card} style={{ textAlign: "center" }}>
                  Camera permission is required for driver face attendance.
                </DSText>
                <PillButton label="Allow camera" onPress={() => { void requestPermission(); }} />
              </View>
            )}
          </View>

          {error ? <DSText variant="caption" tint={t.bad}>{error}</DSText> : null}
          <DSText variant="caption" tint={t.mute}>
            Demo verification only. Production will validate the frame on the server before marking attendance.
          </DSText>

          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <PillButton label="Cancel" block bg={t.card} fg={t.mute} onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              {!permission?.granted ? (
                <PillButton
                  label="Allow camera"
                  block
                  icon="camera-alt"
                  onPress={() => { void requestPermission(); }}
                />
              ) : busy && !success ? (
                <View style={{ alignItems: "center", paddingVertical: 13 }}>
                  <ActivityIndicator color={t.blue} />
                </View>
              ) : (
                <PillButton
                  label={success ? "Verified" : "Scan face"}
                  block
                  icon={success ? "check" : "face"}
                  bg={success ? t.ok : t.blue}
                  onPress={() => { void capture(); }}
                />
              )}
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
