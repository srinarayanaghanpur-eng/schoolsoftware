/**
 * Root layout — rebuilt 2026-07-21.
 * Mounts SafeAreaProvider (missing entirely in the old app), the session
 * provider, and the router stack. No visual shell here: workspace layouts
 * (e.g. app/parent/_layout.tsx) own their own chrome.
 */
import React, { useEffect, useState } from "react";
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
import { MobileSessionProvider, useMobileSession } from "@/lib/mobileSession";
import { AppLockGate } from "@/lib/AppLockGate";
import { setupPushListeners } from "@/lib/pushNotifications";
import { ErrorBoundary } from "@/lib/ErrorBoundary";
import { ThemeProvider, useTheme } from "@/lib/Theme";
import { ThemedStack } from "@/lib/ThemedStack";
import { ToastProvider } from "@/design-system/components";
import FunLoader from "@/design-system/FunLoader";

function PushBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => setupPushListeners(), []);
  return <>{children}</>;
}

// The native splash remains visible until the session check finishes, so the
// first rendered route never exposes a blank themed frame.
function SplashGate({ children }: { children: React.ReactNode }) {
  const { status } = useMobileSession();
  useEffect(() => {
    if (status !== "checking") {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);
  return <>{children}</>;
}

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppBootstrap({ fontsReady }: { fontsReady: boolean }) {
  const { t, dark, hydrated } = useTheme();
  const ready = fontsReady && hydrated;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 80);
    const minTimer = setTimeout(() => setMinElapsed(true), 2400);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(minTimer);
    };
  }, []);

  if (!ready || !minElapsed) {
    return (
      <View
        style={[
          styles.stage,
          { backgroundColor: Platform.OS === "web" ? t.page : t.bg }
        ]}
      >
        <View
          style={[
            styles.appFrame,
            { backgroundColor: t.bg },
            Platform.OS === "web" ? { shadowColor: t.ink } : null
          ]}
        >
          <FunLoader backgroundColor={t.bg} textColor={t.blue} />
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={t.bg}
      />
      <View
        style={[
          styles.stage,
          { backgroundColor: Platform.OS === "web" ? t.page : t.bg }
        ]}
      >
        <View
          style={[
            styles.appFrame,
            { backgroundColor: t.bg },
            Platform.OS === "web" ? { shadowColor: t.ink } : null
          ]}
        >
          <ErrorBoundary>
            <MobileSessionProvider>
              <ToastProvider>
                <SplashGate>
                  <PushBootstrap>
                    <AppLockGate>
                      <ThemedStack />
                    </AppLockGate>
                  </PushBootstrap>
                </SplashGate>
              </ToastProvider>
            </MobileSessionProvider>
          </ErrorBoundary>
        </View>
      </View>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppBootstrap fontsReady={fontsLoaded || fontError != null} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center"
  },
  appFrame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 428 : undefined,
    ...(Platform.OS === "web"
      ? {
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.14,
          shadowRadius: 32
        }
      : {})
  }
});
