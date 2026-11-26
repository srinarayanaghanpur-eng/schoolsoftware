import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";

export function FaceAttendanceScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top + 16 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={[styles.back, { backgroundColor: t.card, borderColor: t.line }]}
      >
        <Icon name="arrow-back" size={21} tint={t.ink} />
      </Pressable>
      <View style={styles.center}>
        <Icon name="phone-android" size={48} tint={t.blue} />
        <Text style={[styles.title, { color: t.ink }]}>Face attendance needs the mobile app</Text>
        <Text style={[styles.body, { color: t.mute }]}>
          Open NarayanaOS on the school tablet or phone. The browser preview cannot use the camera
          and on-device face model.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  back: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: 28 },
  title: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 21, textAlign: "center" }
});
