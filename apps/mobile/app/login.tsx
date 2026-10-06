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
  Image,
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
              <Image
                source={require("../assets/LOGO.png")}
                style={{ width: 64, height: 64, borderRadius: 16 }}
                resizeMode="contain"
                accessibilityLabel="NarayanaOS school logo"
              />
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

            {/* school identity */}
            <View style={styles.identity}>
              <Text style={[styles.identityName, { color: th.text }]}>NARAYANAOS</Text>
              <Text style={[styles.identityTag, { color: th.sub }]}>Your School. One App.</Text>
              <Text style={[styles.identityScope, { color: th.faint }]}>
                Attendance • Fees • Academics • Communication
              </Text>
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
  motto: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" },
  identity: { alignItems: "center", gap: 2, marginTop: 6 },
  identityName: { fontSize: 15, fontWeight: "800", letterSpacing: 3 },
  identityTag: { fontSize: 12, fontWeight: "600" },
  identityScope: { fontSize: 10, letterSpacing: 1 },
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
