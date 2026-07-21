/**
 * Root layout — rebuilt 2026-07-21.
 * Mounts SafeAreaProvider (missing entirely in the old app), the session
 * provider, and the router stack. No visual shell here: workspace layouts
 * (e.g. app/parent/_layout.tsx) own their own chrome.
 */
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileSessionProvider } from "@/lib/mobileSession";
import { color } from "@/design-system/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={color.background} />
      <MobileSessionProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }} />
      </MobileSessionProvider>
    </SafeAreaProvider>
  );
}
