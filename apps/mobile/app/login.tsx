/**
 * Login — rebuilt on the new design system.
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
import { employeeIdToInternalEmail } from "@sri-narayana/shared/utils/employeeAuth";
import { auth } from "@/lib/firebase";
import { clearMobileAuthStorage } from "@/lib/authStorage";
import { resolveMobileSession, useMobileSession } from "@/lib/mobileSession";
import { DSText, Icon, PressableScale } from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { dashboardPathForRole } from "@/lib/roleRouting";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* brand */}
          <View style={styles.brand}>
            <View style={[styles.logo, elevation.hero]}>
              <Icon name="school" size={34} tint={color.onPrimary} />
            </View>
            <Text style={styles.brandName}>Sri Narayana High School</Text>
            <Text style={styles.brandSub}>School ERP</Text>
          </View>

          {/* form */}
          <View style={styles.formCard}>
            <DSText variant="title" style={{ fontSize: 20 }}>Welcome back</DSText>
            <DSText variant="label" style={{ marginTop: -2 }}>
              Sign in with the login ID given by the school office.
            </DSText>

            {errorMessage || session.error ? (
              <View style={styles.errorBox}>
                <Icon name="error-outline" size={18} tint={color.error} />
                <DSText variant="label" tint={color.error} style={{ flex: 1 }}>
                  {errorMessage ?? session.error}
                </DSText>
              </View>
            ) : null}

            <DSText variant="overline" style={styles.fieldLabel}>LOGIN ID</DSText>
            <View style={styles.inputRow}>
              <Icon name="badge" size={19} tint={color.muted} />
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
            </View>

            <DSText variant="overline" style={styles.fieldLabel}>PASSWORD</DSText>
            <View style={styles.inputRow}>
              <Icon name="lock-outline" size={19} tint={color.muted} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={color.muted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={login}
              />
              <PressableScale
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Icon name={showPassword ? "visibility-off" : "visibility"} size={20} tint={color.muted} />
              </PressableScale>
            </View>

            <PressableScale
              accessibilityLabel="Sign in"
              onPress={loading ? undefined : login}
              style={[styles.button, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in"}</Text>
              {loading ? null : <Icon name="arrow-forward" size={19} tint={color.onPrimary} />}
            </PressableScale>
          </View>

          <View style={styles.footer}>
            <Icon name="lock" size={13} tint={color.muted} />
            <DSText variant="caption">Secure sign-in · contact the office if you need access</DSText>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.background },
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: space.xl, gap: space.xl },
  brand: { alignItems: "center", gap: space.sm },
  logo: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: color.primaryGradientA,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs
  },
  brandName: {
    fontSize: 22,
    fontWeight: "700",
    color: color.ink,
    letterSpacing: -0.4,
    textAlign: "center"
  },
  brandSub: { fontSize: 13, fontWeight: "600", color: color.primary, letterSpacing: 0.5 },
  formCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: 20,
    gap: space.sm,
    ...elevation.card
  },
  errorBox: {
    backgroundColor: color.errorContainer,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm
  },
  fieldLabel: { marginTop: space.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.surfaceVariant,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.md,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: color.ink
  },
  button: {
    minHeight: 54,
    backgroundColor: color.primary,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.lg
  },
  buttonText: { color: color.onPrimary, fontSize: 16, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs + 2 }
});
