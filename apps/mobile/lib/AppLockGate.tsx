import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { DSText, Icon, PillButton } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { getAppLockConfig, type AppLockConfig } from "@/lib/api";
import { readCachedAppLock, writeCachedAppLock } from "@/lib/appLock";
import { useMobileSession } from "@/lib/mobileSession";
import { useTheme } from "@/lib/Theme";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { status, profile, logout } = useMobileSession();
  const { t } = useTheme();
  const [config, setConfig] = useState<AppLockConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundAt = useRef<number | null>(null);
  const prompted = useRef(false);

  const applies = Boolean(
    config?.enabled && profile && config.roles.includes(profile.role)
  );

  const uid = profile?.uid;
  const userRole = profile?.role;

  useEffect(() => {
    let cancelled = false;
    let startupHandled = false;

    if (status !== "authenticated" || !uid || !userRole) {
      setConfig(null);
      setLocked(false);
      setError(null);
      return;
    }

    void (async () => {
      const cached = await readCachedAppLock();
      if (cancelled) return;
      if (cached) {
        setConfig(cached);
        if (cached.enabled && cached.roles.includes(userRole)) {
          startupHandled = true;
          if (cached.lockOnStartup) setLocked(true);
        }
      }

      try {
        const fresh = await getAppLockConfig();
        if (cancelled) return;
        setConfig(fresh);
        void writeCachedAppLock(fresh);
        if (!startupHandled && fresh.enabled && fresh.roles.includes(userRole) && fresh.lockOnStartup) {
          setLocked(true);
        }
      } catch {
        if (!cancelled && !cached) setConfig(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, uid, userRole]);

  useEffect(() => {
    if (!applies) return;
    const timeoutMs = Math.max(0, config?.timeoutMinutes ?? 5) * 60_000;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const awaySince = backgroundAt.current;
        backgroundAt.current = null;
        if (awaySince != null && Date.now() - awaySince >= timeoutMs) {
          setLocked(true);
        }
        return;
      }
      if (nextState === "background" || nextState === "inactive") {
        if (backgroundAt.current == null) backgroundAt.current = Date.now();
      }
    });

    return () => subscription.remove();
  }, [applies, config?.timeoutMinutes]);

  const unlock = useCallback(async () => {
    if (unlocking) return;
    setUnlocking(true);
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        throw new Error("This phone does not support face or biometric unlock.");
      }
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        throw new Error("Set up Face ID or biometrics in your phone settings first.");
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock NarayanaOS",
        cancelLabel: "Cancel",
        disableDeviceFallback: config?.allowDeviceFallback === false
      });
      if (result.success) {
        setLocked(false);
        backgroundAt.current = null;
        return;
      }
      if (result.error !== "user_cancel" && result.error !== "system_cancel") {
        setError("Face or biometric unlock failed. Try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unlock the app.");
    } finally {
      setUnlocking(false);
    }
  }, [config?.allowDeviceFallback, unlocking]);

  useEffect(() => {
    if (!locked) {
      prompted.current = false;
      return;
    }
    if (!prompted.current) {
      prompted.current = true;
      void unlock();
    }
  }, [locked, unlock]);

  return (
    <>
      {children}
      <Modal visible={locked} animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
        <View
          style={{
            flex: 1,
            backgroundColor: t.page,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
            gap: space.md
          }}
        >
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: radius.pill,
              backgroundColor: t.tint,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Icon name="lock" size={38} tint={t.blue} />
          </View>
          <DSText variant="title" style={{ textAlign: "center" }}>
            NarayanaOS is locked
          </DSText>
          <DSText variant="bodyMedium" tint={t.mute} style={{ textAlign: "center", maxWidth: 300 }}>
            Use your phone&apos;s face or biometric unlock to continue.
          </DSText>
          {error ? (
            <DSText variant="label" tint={t.bad} style={{ textAlign: "center", maxWidth: 320 }}>
              {error}
            </DSText>
          ) : null}
          <View style={{ width: "100%", maxWidth: 320, gap: space.sm, marginTop: space.sm }}>
            <PillButton
              label={unlocking ? "Unlocking..." : "Unlock"}
              icon={unlocking ? undefined : "fingerprint"}
              onPress={() => void unlock()}
              disabled={unlocking}
              block
            />
            <PillButton
              label="Sign out"
              bg="transparent"
              fg={t.mute}
              onPress={() => {
                setLocked(false);
                void logout();
              }}
              disabled={unlocking}
              block
            />
          </View>
          {unlocking ? <ActivityIndicator color={t.blue} /> : null}
        </View>
      </Modal>
    </>
  );
}
