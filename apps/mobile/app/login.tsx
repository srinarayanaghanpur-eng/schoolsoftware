import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { auth } from "@/lib/firebase";
import { clearMobileAuthStorage } from "@/lib/authStorage";
import { dashboardPathForRole } from "@/lib/mobileTheme";
import { resolveMobileSession, useMobileSession } from "@/lib/mobileSession";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const redirectedRef = useRef(false);
  const session = useMobileSession();

  useEffect(() => {
    if (redirectedRef.current || session.status !== "authenticated" || !session.profile) return;
    redirectedRef.current = true;
    router.replace(dashboardPathForRole(session.profile.role) as never);
  }, [router, session.profile, session.status]);

  const login = async () => {
    if (!employeeId.trim() || !password.trim()) {
      Alert.alert("Missing details", "Please enter your Employee ID and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const loginId = employeeId.trim();
      const loginEmail = loginId.includes("@") ? loginId : employeeIdToInternalEmail(loginId);
      const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const profile = await resolveMobileSession(credential.user);
      redirectedRef.current = true;
      router.replace(dashboardPathForRole(profile.role) as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your credentials.";
      setErrorMessage(message);
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex} keyboardVerticalOffset={Platform.OS === "android" ? -200 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.kicker} allowFontScaling={false}>Sri Narayana High School</Text>
            <Text style={styles.title} allowFontScaling={false}>School ERP</Text>
            <Text style={styles.subtitle} allowFontScaling={false}>Sign in to open your Teacher, Parent, Principal, Admin or Accounts workspace.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle} allowFontScaling={false}>Welcome back</Text>
            <Text style={styles.formHint} allowFontScaling={false}>Use the login ID given by the school office.</Text>
            {session.error || errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} allowFontScaling={false}>{session.error ?? errorMessage}</Text>
              </View>
            ) : null}
            <Text style={styles.label} allowFontScaling={false}>Employee / Login ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: TCH001 or ADM001"
              placeholderTextColor="#9aa3bd"
              autoCapitalize="characters"
              autoCorrect={false}
              value={employeeId}
              onChangeText={setEmployeeId}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              allowFontScaling={false}
            />
            <Text style={styles.label} allowFontScaling={false}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#9aa3bd"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={login}
              allowFontScaling={false}
            />
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
              onPress={login}
              disabled={loading}
            >
              <Text style={styles.buttonText} allowFontScaling={false}>{loading ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f6fd" },
  page: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 18 },
  hero: { overflow: "hidden", borderRadius: 26, backgroundColor: "#2c2f8d", padding: 22, minHeight: 190, justifyContent: "flex-end" },
  heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "#5458bd", opacity: 0.38, right: -72, top: -78 },
  kicker: { color: "#f7c548", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, fontSize: 11 },
  title: { marginTop: 10, fontSize: 34, fontWeight: "900", color: "white", letterSpacing: -1.1 },
  subtitle: { marginTop: 10, color: "#dbe0ff", fontSize: 14, lineHeight: 20, fontWeight: "600" },
  formCard: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e3e6f0",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#242a5e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  formTitle: { color: "#1b1d32", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  formHint: { marginTop: 5, marginBottom: 18, color: "#7d86a8", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  errorBox: { backgroundColor: "#fbe5ea", borderWidth: 1, borderColor: "#f6bac7", borderRadius: 14, padding: 12, marginBottom: 14 },
  errorText: { color: "#b1304a", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  label: { marginBottom: 7, color: "#4f587a", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#f8f9ff",
    borderWidth: 1,
    borderColor: "#dfe3f2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    color: "#1b1d32",
    fontSize: 15,
    fontWeight: "700"
  },
  button: { minHeight: 54, backgroundColor: "#3033a1", borderRadius: 16, padding: 15, marginTop: 4, justifyContent: "center" },
  buttonText: { color: "white", textAlign: "center", fontWeight: "900", fontSize: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.62 }
});
