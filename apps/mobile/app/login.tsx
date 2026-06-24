import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { employeeIdToInternalEmail } from "@sri-narayana/shared";
import { auth, db } from "@/lib/firebase";

export default function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, employeeIdToInternalEmail(employeeId), password);
      const token = await credential.user.getIdTokenResult();
      if (token.claims.role !== "teacher") {
        await signOut(auth);
        throw new Error("Teacher access required.");
      }

      const userSnapshot = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnapshot.exists() ? (userSnapshot.data() as { status?: string }) : undefined;
      if (userData?.status !== "active") {
        await signOut(auth);
        throw new Error("Your teacher login is inactive. Please contact admin.");
      }

      router.replace("/home");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>Sri Narayana</Text>
      <Text style={styles.title}>Staff Attendance</Text>
      <Text style={styles.subtitle}>Teacher mobile attendance with campus GPS lock.</Text>
      <TextInput style={styles.input} placeholder="Employee ID" autoCapitalize="characters" value={employeeId} onChangeText={setEmployeeId} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.button} onPress={login} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in with Employee ID"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f4f7f3" },
  kicker: { color: "#047857", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  title: { marginTop: 8, fontSize: 31, fontWeight: "800", color: "#17211b" },
  subtitle: { marginTop: 8, marginBottom: 24, color: "#66736a" },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 8, padding: 14, marginBottom: 12 },
  button: { backgroundColor: "#047857", borderRadius: 8, padding: 15, marginTop: 4 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700" }
});
