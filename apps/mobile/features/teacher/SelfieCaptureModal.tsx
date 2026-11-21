import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Card, DSText, PillButton } from "@/design-system/components";
import { space, radius } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { uploadAttendanceSelfie } from "@/lib/attendanceSelfie";
import type { AttendanceEvent } from "@/features/teacher/useAttendanceMarking";

type Props = {
  visible: boolean;
  teacherId: string;
  event: AttendanceEvent;
  onCancel: () => void;
  onUploaded: (storagePath: string) => void;
};

/**
 * School-policy selfie step for attendance. Captures with the front camera,
 * uploads to attendance-selfies/{teacherId}/ and hands back the storage path.
 */
export function SelfieCaptureModal({ visible, teacherId, event, onCancel, onUploaded }: Props) {
  const { t } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  async function capture() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) throw new Error("Camera did not return a photo.");
      const storagePath = await uploadAttendanceSelfie(teacherId, photo.uri, event);
      onUploaded(storagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload the selfie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          justifyContent: "center",
          padding: space.xl
        }}
      >
        <Card style={{ gap: space.md, padding: space.md }}>
          <DSText variant="title">Attendance selfie</DSText>
          <DSText variant="body">
            Your school requires a selfie for {event === "checkin" ? "check-in" : "check-out"}.
          </DSText>

          <View
            style={{
              height: 340,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: t.ink
            }}
          >
            {permission?.granted ? (
              <CameraView ref={cameraRef} facing="front" style={{ flex: 1 }} />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: space.lg,
                  gap: space.md
                }}
              >
                <DSText variant="bodyMedium" tint={t.card} style={{ textAlign: "center" }}>
                  Camera permission is required to take the attendance selfie.
                </DSText>
                <PillButton label="Allow camera" onPress={() => { void requestPermission(); }} />
              </View>
            )}
          </View>

          {error ? (
            <DSText variant="caption" tint={t.bad}>
              {error}
            </DSText>
          ) : null}

          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <PillButton label="Cancel" block bg={t.card} fg={t.mute} onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton
                label={busy ? "Uploading…" : "Take selfie"}
                block
                icon="photo-camera"
                onPress={() => { void capture(); }}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
