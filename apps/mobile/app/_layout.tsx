/**
 * Root layout — rebuilt 2026-07-21.
 * Mounts SafeAreaProvider (missing entirely in the old app), the session
 * provider, and the router stack. No visual shell here: workspace layouts
 * (e.g. app/parent/_layout.tsx) own their own chrome.
 */
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold
} from "@expo-google-fonts/plus-jakarta-sans";
import { MobileSessionProvider } from "@/lib/mobileSession";
import { setupPushListeners } from "@/lib/pushNotifications";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { ThemeProvider } from "@/lib/Theme";
import { color } from "@/design-system/tokens";

function PushBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => setupPushListeners(), []);
  return <>{children}</>;
}

// Keep the native splash up until fonts are ready — the tree renders
// nothing before that, so without this the launch shows a white flash.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={color.background} />
      <View style={styles.stage}>
        <View style={styles.appFrame}>
          <ErrorBoundary>
            <ThemeProvider>
              <MobileSessionProvider>
                <PushBootstrap>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }} />
                </PushBootstrap>
              </MobileSessionProvider>
            </ThemeProvider>
          </ErrorBoundary>
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
