/**
 * In-app "screenshot-style" tutorial for Android's location permission.
 *
 * Android does not allow an app to programmatically select "Allow all the
 * time"; the driver must confirm it in system settings. This mock settings
 * screen makes that step obvious without shipping a stale real screenshot.
 */
import React from "react";
import { Modal, ScrollView, View } from "react-native";
import { Badge, Card, DSText, Icon, PillButton, PressableScale } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useDriverDemo } from "./DriverDemoContext";

function PermissionRow({
  label,
  description,
  selected
}: {
  label: string;
  description?: string;
  selected?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: 11,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: selected ? t.tint : "transparent",
        borderWidth: selected ? 1.5 : 0,
        borderColor: selected ? t.blue : "transparent"
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? t.blue : t.faint,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {selected ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.blue }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <DSText variant="bodyMedium" tint={selected ? t.blue : t.ink}>{label}</DSText>
        {description ? <DSText variant="caption">{description}</DSText> : null}
      </View>
      {selected ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="touch-app" size={16} tint={t.blue} />
          <DSText variant="caption" tint={t.blue} style={{ fontWeight: "700" }}>Select</DSText>
        </View>
      ) : null}
    </View>
  );
}

export function LocationTutorialModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTheme();
  const { openSettings } = useDriverDemo();

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
              <DSText variant="title">Allow location all the time</DSText>
              <DSText variant="label">Required for the bus route to keep tracking</DSText>
            </View>
            <PressableScale accessibilityLabel="Close" onPress={onClose}>
              <Icon name="close" size={23} tint={t.mute} />
            </PressableScale>
          </View>

          <ScrollView
            style={{ maxHeight: 390 }}
            contentContainerStyle={{ alignItems: "center", paddingVertical: space.sm }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 300,
                borderRadius: 34,
                borderWidth: 8,
                borderColor: t.ink,
                overflow: "hidden",
                backgroundColor: t.card
              }}
            >
              <View style={{ height: 24, backgroundColor: t.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 }}>
                <DSText variant="caption" tint={t.card} style={{ fontSize: 9 }}>9:41</DSText>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <View style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: t.card }} />
                  <View style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: t.card }} />
                  <View style={{ width: 14, height: 6, borderRadius: 2, backgroundColor: t.card }} />
                </View>
              </View>

              <View style={{ padding: 14, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="arrow-back" size={20} tint={t.ink} />
                  <DSText variant="bodyMedium" style={{ flex: 1 }}>Settings</DSText>
                  <Badge label="ANDROID" bg={t.tint} fg={t.blue} />
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.tint, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="directions-bus" size={19} tint={t.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DSText variant="bodyMedium">NarayanaOS</DSText>
                    <DSText variant="caption">App permissions</DSText>
                  </View>
                  <Icon name="chevron-right" size={19} tint={t.faint} />
                </View>

                <View style={{ height: 1, backgroundColor: t.line }} />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="location-on" size={18} tint={t.blue} />
                  <DSText variant="overline" tint={t.mute}>LOCATION</DSText>
                </View>

                <PermissionRow label="While using the app" description="Tracking pauses when the screen locks" />
                <PermissionRow label="Only this time" description="Not suitable for a full bus trip" />
                <PermissionRow label="Don't allow" description="GPS cannot start" />
                <PermissionRow label="Allow all the time" description="Recommended for school bus duty" selected />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    borderRadius: radius.sm,
                    backgroundColor: t.okBg
                  }}
                >
                  <Icon name="info" size={17} tint={t.ok} />
                  <DSText variant="caption" tint={t.ok} style={{ flex: 1, fontWeight: "600" }}>
                    Tap "Allow all the time", then return to NarayanaOS.
                  </DSText>
                </View>
              </View>
            </View>
          </ScrollView>

          <DSText variant="caption" style={{ textAlign: "center" }}>
            The real settings screen may look slightly different on your phone.
          </DSText>

          <PillButton
            label="Open phone settings"
            icon="settings"
            onPress={() => {
              openSettings();
              onClose();
            }}
          />
          <PillButton label="Done" block bg={t.card} fg={t.mute} onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}
