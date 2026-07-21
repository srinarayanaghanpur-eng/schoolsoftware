/**
 * Login — rebuilt 2026-07-21 on the new design system.
 * Auth flow is unchanged (employeeIdToInternalEmail → Firebase sign-in →
 * resolveMobileSession); only the presentation is new.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableWithoutFeedback, View
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { auth } from "@/lib/firebase";
import { clearMobileAuthStorage } from "@/lib/authStorage";
import { resolveMobileSession, useMobileSession } from "@/lib/mobileSession";
import { DSText, PressableScale } from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { dashboardPathForRole } from "@/lib/roleRouting";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const redirectedRef = useRef(false);
  const session = useMobileSession();

  useEffect(() => {
    if (redirectedRef.current || session.status !== "authenticated" || !session.profile) return;
    const path = dashboardPathForRole(session.profile.role);
    if (path === "/login") return; // workspace not built yet — stay on login with message
    redirectedRef.current = true;
    router.replace(path as never);
  }, [router, session.profile, session.status]);

  const login = async () => {
    if (!employeeId.trim() || !password.trim()) {
      setErrorMessage("Please enter your Login ID and password.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const loginId = employeeId.trim();
      const loginEmail = loginId.includes("@") ? loginId : employeeIdToInternalEmail(loginId);
      const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const profile = await resolveMobileSession(credential.user);
      const path = dashboardPathForRole(profile.role);
      if (path === "/login") {
        setErrorMessage("This workspace is not available in the mobile app yet. Please use the web portal.");
        await signOut(auth).catch(() => undefined);
        await clearMobileAuthStorage().catch(() => undefined);
        return;
      }
      redirectedRef.current = true;
      router.replace(path as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your credentials.";
      setErrorMessage(message);
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, elevation.hero]}>
            <DSText variant="overline" tint={color.primaryContainer}>SRI NARAYANA HIGH SCHOOL</DSText>
            <Text style={styles.heroTitle}>School ERP</Text>
            <Text style={styles.heroSub}>Sign in with the login ID given by the school office.</Text>
          </View>

          <View style={styles.formCard}>
            <DSText variant="title" style={{ fontSize: 20 }}>Welcome back</DSText>
            {errorMessage || session.error ? (
              <View style={styles.errorBox}>
                <DSText variant="label" tint={color.error}>{errorMessage ?? session.error}</DSText>
              </View>
            ) : null}

            <DSText variant="overline" style={styles.fieldLabel}>LOGIN ID</DSText>
            <TextInput
              style={styles.input}
              placeholder="e.g. TCH001 or PAR001"
              placeholderTextColor={color.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={employeeId}
              onChangeText={setEmployeeId}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <DSText variant="overline" style={styles.fieldLabel}>PASSWORD</DSText>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={color.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={login}
            />
            <PressableScale
              accessibilityLabel="Sign in"
              onPress={loading ? undefined : login}
              style={[styles.button, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in"}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: space.xl, gap: space.lg },
  hero: {
    backgroundColor: color.primaryGradientA,
    borderRadius: radius.xl + 4,
    padding: 22,
    minHeight: 170,
    justifyContent: "flex-end",
    gap: 8
  },
  heroTitle: { fontSize: 32, fontWeight: "700", color: color.onPrimary, letterSpacing: -0.8 },
  heroSub: { fontSize: 14, lineHeight: 20, color: color.primaryContainer },
  formCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: 18,
    gap: space.sm,
    ...elevation.card
  },
  errorBox: {
    backgroundColor: color.errorContainer,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.xs
  },
  fieldLabel: { marginTop: space.sm },
  input: {
    backgroundColor: color.surfaceVariant,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: color.ink
  },
  button: {
    minHeight: 52,
    backgroundColor: color.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.md
  },
  buttonText: { color: color.onPrimary, fontSize: 16, fontWeight: "600" }
});
