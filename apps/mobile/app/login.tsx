import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "@firebase/auth";
import { doc, getDoc } from "@firebase/firestore";
import { employeeIdToInternalEmail, isValidRole } from "@sri-narayana/shared";
import { auth, db } from "@/lib/firebase";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    if (!employeeId.trim() || !password.trim()) {
      Alert.alert("Missing details", "Please enter your Employee ID and password.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, employeeIdToInternalEmail(employeeId.trim()), password);
      const token = await credential.user.getIdTokenResult();

      // Resolve role from the custom claim, falling back to the users doc so that
      // accounts whose claim hasn't propagated yet (or any valid role) can still sign in.
      const userSnapshot = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnapshot.exists() ? (userSnapshot.data() as { role?: unknown; status?: string }) : undefined;
      const claimRole = token.claims.role;
      const docRole = userData?.role;
      const role = isValidRole(claimRole) ? claimRole : isValidRole(docRole) ? docRole : undefined;

      if (!role) {
        await signOut(auth);
        throw new Error("Your login role is missing. Please contact admin.");
      }

      if (userData?.status && userData.status !== "active") {
        await signOut(auth);
        throw new Error("Your login is inactive. Please contact admin.");
      }

      router.replace("/home");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.kicker}>Sri Narayana High School</Text>
            <Text style={styles.title}>Teacher Attendance</Text>
            <Text style={styles.subtitle}>Sign in to mark GPS-secured attendance and view your monthly records.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formHint}>Use the Employee ID given by the admin office.</Text>
            <Text style={styles.label}>Employee ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: TCH001"
              placeholderTextColor="#9aa3bd"
              autoCapitalize="characters"
              autoCorrect={false}
              value={employeeId}
              onChangeText={setEmployeeId}
              returnKeyType="next"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#9aa3bd"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={login}
            />
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
              onPress={login}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fd" },
  keyboard: { flex: 1 },
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
