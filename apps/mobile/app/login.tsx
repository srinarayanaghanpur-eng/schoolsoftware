/**
 * Login — reference-spec rebuild (neumorphic + glass, lavender theme).
 *
 * Layout per spec: dark toggle, logo tile, title/subtitle, two fields,
 * remember/forgot row, gradient login button, divider, social row
 * (flag-gated, Google visible only), motto footer. Content 85% width.
 * Dark mode follows the app theme. Login ID is CAPS-LOCKED by transform.
 * Auth logic (Firebase sign-in, session redirect, workspace gating)
 * is unchanged — only presentation is new.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { auth } from "@/lib/firebase";
import { clearMobileAuthStorage, REMEMBER_CHOICE_KEY } from "@/lib/authStorage";
import { resolveMobileSession, useMobileSession } from "@/lib/mobileSession";
import { useToast } from "@/design-system/components";
import { useTheme } from "@/lib/Theme";
import { dashboardPathForRole } from "@/lib/roleRouting";

/* ------------------------------ school knobs ----------------------------- */

const SCHOOL_MOTTO = "LEARN • GROW • ACHIEVE";
const SHOW_SOCIAL = { google: true, discord: false, facebook: false };

/* --------------------------------- themes -------------------------------- */

type LoginTheme = {
  bgFrom: string;
  bgTo: string;
  shape: string;
  shapeEdge: string;
  text: string;
  sub: string;
  faint: string;
  tile: string;
  tileBorder: string;
  field: string;
  icon: string;
  placeholder: string;
  divider: string;
  rememberBox: string;
};

const LIGHT: LoginTheme = {
  bgFrom: "#F1F4FC",
  bgTo: "#E2E9F7",
  shape: "#D8E2FA",
  shapeEdge: "#4A8CFF",
  text: "#0B1033",
  sub: "#6B7494",
  faint: "#8F98B3",
  tile: "rgba(255,255,255,0.55)",
  tileBorder: "rgba(255,255,255,0.9)",
  field: "#EEF2FC",
  icon: "#5C6688",
  placeholder: "#8F98B3",
  divider: "rgba(120,140,200,0.25)",
  rememberBox: "#2F5BEA"
};

const DARK: LoginTheme = {
  bgFrom: "#0E1226",
  bgTo: "#171C3A",
  shape: "#1B2350",
  shapeEdge: "#5B93FF",
  text: "#F2F4FF",
  sub: "#9AA3C7",
  faint: "#9AA3C7",
  tile: "rgba(255,255,255,0.08)",
  tileBorder: "rgba(255,255,255,0.16)",
  field: "#1A2040",
  icon: "#9AA3C7",
  placeholder: "#9AA3C7",
  divider: "rgba(154,163,199,0.25)",
  rememberBox: "#2F5BEA"
};

/* --------------------------------- artwork ------------------------------- */

type IconGlyph = React.ComponentProps<typeof MaterialIcons>["name"];

function MaterialIcon({ name, size = 20, color = "#FFFFFF" }: { name: IconGlyph; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

/** School emblem slot: 3 layered ribbons. Replace with the school logo asset. */
function Emblem() {
  return (
    <Svg width={72} height={72} viewBox="0 0 96 96">
      <Defs>
        <SvgGradient id="rib1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1D3FD6" />
          <Stop offset="1" stopColor="#2F5BEA" />
        </SvgGradient>
        <SvgGradient id="rib2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2F5BEA" />
          <Stop offset="1" stopColor="#4A8CFF" />
        </SvgGradient>
      </Defs>
      <Path
        d="M20 68 C 20 44, 40 30, 60 34 C 74 37, 78 50, 72 60 C 64 74, 34 82, 20 68 Z"
        fill="url(#rib1)"
      />
      <Path
        d="M30 60 C 34 46, 50 38, 62 42 C 70 45, 70 54, 64 60 C 56 68, 36 70, 30 60 Z"
        fill="url(#rib2)"
      />
      <Path
        d="M58 28 C 66 28, 72 34, 70 42 C 64 38, 58 34, 54 30 Z"
        fill="#FFFFFF"
        opacity={0.85}
      />
    </Svg>
  );
}

function GoogleMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.44 8.55 1 10.22 1 12s.44 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function DiscordMark() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={1} y={1} width={22} height={22} rx={6} fill="#5865F2" />
      <Circle cx={9} cy={10.5} r={1.4} fill="#FFFFFF" />
      <Circle cx={15} cy={10.5} r={1.4} fill="#FFFFFF" />
      <Path
        d="M8.5 15 Q12 17.5 15.5 15"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function FacebookMark() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#1877F2" />
      <Path
        d="M13.5 21v-7h2.4l.6-3h-3V9.1c0-.9.3-1.6 1.7-1.6h1.9V4.8c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5V11H8v3h2.1v7z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/** Friendly Firebase codes for parents. */
function friendlyAuthMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (
    code.includes("auth/invalid-credential") ||
    code.includes("auth/wrong-password") ||
    code.includes("auth/user-not-found")
  ) {
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

/* ------------------------------ field (shared) --------------------------- */

function LoginField({
  th,
  icon,
  trailing,
  inputRef,
  ...inputProps
}: {
  th: LoginTheme;
  icon: string;
  trailing?: React.ReactNode;
  inputRef?: React.Ref<TextInput>;
} & Pick<
  React.ComponentProps<typeof TextInput>,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "secureTextEntry"
  | "autoCapitalize"
  | "autoCorrect"
  | "autoComplete"
  | "returnKeyType"
  | "onSubmitEditing"
  | "accessibilityLabel"
>) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: th.field,
          borderColor: focused ? "#3B6BFF" : "rgba(255,255,255,0.6)",
          shadowColor: focused ? "#3B6BFF" : "#788CC8",
          shadowOpacity: focused ? 0.35 : 0.3,
          shadowRadius: focused ? 10 : 16,
          shadowOffset: { width: 4, height: 6 },
          elevation: focused ? 4 : 2
        }
      ]}
    >
      <MaterialIcon name={icon as IconGlyph} size={18} color={th.icon} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: th.text }]}
        placeholderTextColor={th.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      {trailing}
    </View>
  );
}

/* ---------------------------------- screen ------------------------------- */

export default function Login() {
  const { dark, toggle } = useTheme();
  const th: LoginTheme = dark ? DARK : LIGHT;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const session = useMobileSession();
  const { width } = useWindowDimensions();

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const redirectedRef = useRef(false);

  // Entrance: logo fades/scales in, blocks stagger up.
  const logoAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(riseAnim, {
        toValue: 1,
        duration: 300,
        delay: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true
      })
    ]).start();
  }, [logoAnim, riseAnim]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence(
      [1, -1, 0.7, -0.7, 0].map((to) =>
        Animated.timing(shakeAnim, { toValue: to, duration: 55, useNativeDriver: true })
      )
    ).start();
  };

  useEffect(() => {
    if (redirectedRef.current || session.status !== "authenticated" || !session.profile) return;
    const path = dashboardPathForRole(session.profile.role);
    if (path === "/login") return;
    redirectedRef.current = true;
    router.replace(path as never);
  }, [router, session.profile, session.status]);

  const login = async () => {
    if (!employeeId.trim() || !password.trim()) {
      setErrorMessage("Please enter your Login ID and password.");
      shake();
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const loginId = employeeId.trim();
      const loginEmail = loginId.includes("@") ? loginId : employeeIdToInternalEmail(loginId);
      const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      await AsyncStorage.setItem(REMEMBER_CHOICE_KEY, remember ? "1" : "0").catch(() => undefined);
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
      shake();
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  const contentWidth = Math.min(width * 0.85, 380);
  const logoSize = Math.max(96, Math.min(120, width * 0.28));
  const formError = errorMessage ?? session.error;

  return (
    <View style={[styles.root, { borderRadius: 28, overflow: "hidden" }]}>
      <LinearGradient
        colors={[th.bgFrom, th.bgTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* decorative shapes (behind everything, non-interactive) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[th.shape, "transparent"]}
          style={[styles.blobTL, { borderColor: th.shapeEdge, borderWidth: 3 }]}
        />
        <View style={[styles.blobR, { backgroundColor: th.shape }]}>
          <View style={styles.blobRGloss} />
        </View>
        <View style={[styles.blobBL, { borderColor: th.shapeEdge }]} />
        <View style={[styles.blobBR, { borderColor: th.shapeEdge }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.page,
            { width: contentWidth, alignSelf: "center", paddingBottom: insets.bottom + 24 }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* dark toggle */}
          <View style={[styles.toggleRow, { paddingTop: insets.top + 8 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dark ? "Switch to light mode" : "Switch to dark mode"}
              onPress={toggle}
              hitSlop={12}
              style={[styles.toggle, { backgroundColor: th.tile, borderColor: th.tileBorder }]}
            >
              <MaterialIcon name={dark ? "light-mode" : "dark-mode"} size={16} color={dark ? "#F2F4FF" : "#1B2250"} />
            </Pressable>
          </View>

          {/* logo */}
          <Animated.View
            style={{
              opacity: logoAnim,
              alignItems: "center",
              transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }]
            }}
          >
            <View
              style={[
                styles.logo,
                {
                  width: logoSize,
                  height: logoSize,
                  borderRadius: 36,
                  backgroundColor: th.tile,
                  borderColor: th.tileBorder
                }
              ]}
            >
              <Emblem />
            </View>
          </Animated.View>

          {/* title */}
          <Animated.View style={{ opacity: riseAnim, alignItems: "center" }}>
            <Text style={[styles.title, { color: th.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: th.sub }]}>Sign in to continue</Text>
          </Animated.View>

          {/* fields */}
          <Animated.View
            style={{
              opacity: riseAnim,
              gap: 12,
              transform: [{ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }]
            }}
          >
            <LoginField
              th={th}
              icon="person-outline"
              value={employeeId}
              onChangeText={(text) => setEmployeeId(text.toUpperCase())}
              placeholder="Username or Email"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Login ID, capitals"
            />
            <LoginField
              th={th}
              icon="lock-outline"
              inputRef={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={login}
              accessibilityLabel="Password"
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={12}
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                >
                  <MaterialIcon name={showPassword ? "visibility-off" : "visibility"} size={18} color={th.icon} />
                </Pressable>
              }
            />
            {formError ? (
              <Text style={styles.helper}>{formError}</Text>
            ) : null}

            {/* remember / forgot */}
            <View style={styles.rememberRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
                accessibilityLabel="Remember me"
                onPress={() => setRemember((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={styles.rememberTap}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: th.sub,
                      backgroundColor: remember ? th.rememberBox : "transparent",
                      borderWidth: remember ? 0 : 1.5
                    }
                  ]}
                >
                  {remember ? <MaterialIcon name="check" size={13} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.rememberText, { color: th.text }]}>Remember Me</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={() => toast.show("Contact the school office to reset your password.")}
              >
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>
            </View>

            {/* login button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Login"
              disabled={loading}
              onPress={loading ? undefined : login}
              style={({ pressed }) => [styles.loginBtn, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}
            >
              <LinearGradient
                colors={["#2563EB", "#4F8BFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                <View style={styles.loginGloss} />
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.loginLabel}>Login</Text>
                    <View style={styles.loginArrow}>
                      <MaterialIcon name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* divider */}
            <View style={styles.dividerRow}>
              <LinearGradient
                colors={["transparent", th.divider]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
              <Text style={[styles.dividerText, { color: th.faint }]}>OR CONTINUE WITH</Text>
              <LinearGradient
                colors={[th.divider, "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
            </View>

            {/* social row (flag-gated; schools show Google only) */}
            <View style={styles.socialRow}>
              {SHOW_SOCIAL.google ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  onPress={() => toast.show("Google sign-in arrives with the school release.")}
                  style={({ pressed }) => [
                    styles.socialTile,
                    { backgroundColor: th.tile, borderColor: th.tileBorder },
                    pressed && { transform: [{ scale: 0.95 }] }
                  ]}
                >
                  <GoogleMark />
                </Pressable>
              ) : null}
              {SHOW_SOCIAL.discord ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Discord"
                  onPress={() => toast.show("Discord sign-in is disabled for schools.")}
                  style={({ pressed }) => [
                    styles.socialTile,
                    { backgroundColor: th.tile, borderColor: th.tileBorder },
                    pressed && { transform: [{ scale: 0.95 }] }
                  ]}
                >
                  <DiscordMark />
                </Pressable>
              ) : null}
              {SHOW_SOCIAL.facebook ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Facebook"
                  onPress={() => toast.show("Facebook sign-in is disabled for schools.")}
                  style={({ pressed }) => [
                    styles.socialTile,
                    { backgroundColor: th.tile, borderColor: th.tileBorder },
                    pressed && { transform: [{ scale: 0.95 }] }
                  ]}
                >
                  <FacebookMark />
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.motto, { color: th.faint }]}>{SCHOOL_MOTTO}</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blobTL: {
    position: "absolute",
    top: -90,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110
  },
  blobR: {
    position: "absolute",
    right: -34,
    top: "38%",
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  blobRGloss: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.65)",
    marginBottom: 18,
    marginRight: 14
  },
  blobBL: {
    position: "absolute",
    left: -70,
    bottom: -70,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
    backgroundColor: "transparent"
  },
  blobBR: {
    position: "absolute",
    right: -90,
    bottom: -50,
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 3,
    backgroundColor: "transparent"
  },
  page: { flexGrow: 1, gap: 16, justifyContent: "center", paddingBottom: 24 },
  toggleRow: { flexDirection: "row", justifyContent: "flex-end" },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3C5AC8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3
  },
  logo: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#3C5AC8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8
  },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: {
    fontSize: 10.5,
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 6
  },
  helper: { fontSize: 11, color: "#E5484D", marginTop: 6, marginLeft: 4 },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44
  },
  rememberTap: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  rememberText: { fontSize: 10, fontWeight: "500" },
  forgot: { fontSize: 10, fontWeight: "600", color: "#1F43D6" },
  loginBtn: { borderRadius: 24 },
  loginGradient: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
    overflow: "hidden"
  },
  loginGloss: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)"
  },
  loginLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  loginArrow: {
    position: "absolute",
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center"
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase" },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  socialTile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  motto: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" },
  eye: { padding: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 14,
    shadowColor: "#788CC8",
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 2,
    overflow: "hidden"
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 12,
    backgroundColor: "transparent",
    borderWidth: 0,
    outlineWidth: 0
  }
});
