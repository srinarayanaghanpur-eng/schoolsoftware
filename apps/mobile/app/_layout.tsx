/**
 * Root layout — rebuilt 2026-07-21.
 * Mounts SafeAreaProvider (missing entirely in the old app), the session
 * provider, and the router stack. No visual shell here: workspace layouts
 * (e.g. app/parent/_layout.tsx) own their own chrome.
 */
import React from "react";
import { Stack } from "expo-router";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileSessionProvider } from "@/lib/mobileSession";
import { color } from "@/design-system/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={color.background} />
      <View style={styles.stage}>
        <View style={styles.appFrame}>
          <MobileSessionProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }} />
          </MobileSessionProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? color.previewBackdrop : color.background,
    alignItems: "center"
  },
  appFrame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 428 : undefined,
    backgroundColor: color.background,
    ...(Platform.OS === "web"
      ? {
          shadowColor: color.ink,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.14,
          shadowRadius: 32
        }
      : {})
  }
});
