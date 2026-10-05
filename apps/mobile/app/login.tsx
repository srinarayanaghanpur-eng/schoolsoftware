/**
 * Login — rebuilt from scratch (new UI).
 * Brand hero on top, form sheet below. Logic unchanged: Login ID sign-in
 * via Firebase, session resolution, role-based redirect.
 * The Login ID field is CAPS-LOCKED: every keystroke is uppercased so IDs
 * like PAR001 can never mismatch on case.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, View
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { auth } from "@/lib/firebase";
import { clearMobileAuthStorage } from "@/lib/authStorage";
import { resolveMobileSession, useMobileSession } from "@/lib/mobileSession";
import { DSText, Icon, PressableScale } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { dashboardPathForRole } from "@/lib/roleRouting";

/** Firebase speaks in codes — parents should see plain words. */
function friendlyAuthMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
    return "Wrong login ID or password. Please try again.";
  }
  if (code.includes("auth/too-many-requests")) {
    return "Too many tries. Please wait a few minutes and try again.";
  }
  if (code.includes("auth/network-request-failed")) {
    return "No internet connection. Please check and try again.";
  }
  if (code.includes("auth/invalid-email")) {
    return "That login ID doesn't look right. Please check it.";
  }
  return "Couldn't sign you in. Please check your details and try again.";
}

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
      setErrorMessage(friendlyAuthMessage(error));
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* brand hero */}
      <View style={[styles.hero, { paddingTop: insets.top + space.xl }]}>
        <View style={styles.logo}>
          <Icon name="school" size={36} tint={color.onPrimary} />
        </View>
        <Text style={styles.schoolName}>Sri Narayana High School</Text>
        <Text style={styles.schoolSub}>SCHOOL ERP · PARENT & STAFF APP</Text>
      </View>

      {/* form sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrap}
      >
        <ScrollView
          contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DSText variant="title" style={styles.welcome}>Welcome back</DSText>
          <DSText variant="label" style={styles.welcomeSub}>
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

          <DSText variant="overline" style={styles.fieldLabel}>LOGIN ID · CAPITALS</DSText>
          <View style={styles.inputRow}>
            <Icon name="badge" size={19} tint={color.muted} />
            <TextInput
              style={[styles.input, styles.capsInput]}
              placeholder="e.g. PAR001"
              placeholderTextColor={color.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={employeeId}
              onChangeText={(text) => setEmployeeId(text.toUpperCase())}
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
              hitSlop={12}
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

          <View style={styles.footer}>
            <Icon name="lock" size={13} tint={color.muted} />
            <DSText variant="caption">Secure sign-in · contact the office if you need access</DSText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.primaryDeep },
  hero: {
    alignItems: "center",
    paddingBottom: space.xxl,
    gap: space.sm
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs
  },
  schoolName: {
    fontSize: 23,
    fontWeight: "700",
    color: color.onPrimary,
    letterSpacing: -0.4,
    textAlign: "center"
  },
  schoolSub: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.75)"
  },
  sheetWrap: { flex: 1, marginTop: -space.xxl },
  sheet: {
    flexGrow: 1,
    backgroundColor: color.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.sm
  },
  welcome: { fontSize: 20 },
  welcomeSub: { marginTop: -2 },
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
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outlineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: color.ink
  },
  capsInput: { letterSpacing: 1.5, fontWeight: "600" },
  button: {
    minHeight: 56,
    backgroundColor: color.primary,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.lg
  },
  buttonText: { color: color.onPrimary, fontSize: 16, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs + 2, marginTop: space.sm }
});
