import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { auth } from "@/lib/firebase";
import { demoTeachers } from "@sri-narayana/shared";
import { useRouter } from "expo-router";
import { signOut } from "@firebase/auth";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function Profile() {
  const teacher = demoTeachers[0];
  const router = useRouter();

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <Screen title="Profile" subtitle={teacher.employeeId}>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {teacher.fullName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{teacher.fullName}</Text>
        <Text style={styles.muted}>{teacher.subject}</Text>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Employee ID</Text>
          <Text style={styles.detailValue}>{teacher.employeeId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone</Text>
          <Text style={styles.detailValue}>{teacher.phone}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Biometric ID</Text>
          <Text style={styles.detailValue}>{teacher.biometricUserId}</Text>
        </View>
      </Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Logout from the teacher app"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={logout}
      >
        <Text style={styles.buttonText}>Logout from this device</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#f7c548", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarText: { color: "#2b2d82", fontSize: 19, fontWeight: "900" },
  name: { fontSize: 24, fontWeight: "900", color: "#1b1d32", marginBottom: 4, textAlign: "center", letterSpacing: -0.5 },
  muted: { marginBottom: 12, color: "#7d86a8", fontSize: 14, fontWeight: "700", textAlign: "center" },
  divider: { alignSelf: "stretch", height: 1, backgroundColor: "#e3e6f0", marginVertical: 12 },
  detailRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#eef1f8" },
  detailLabel: { color: "#7d86a8", fontSize: 13, fontWeight: "800", flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "900", color: "#1b1d32", textAlign: "right", marginLeft: 8, maxWidth: "60%" },
  button: { backgroundColor: "#3033a1", padding: 16, borderRadius: 16, marginTop: 2, minHeight: 54, justifyContent: "center" },
  buttonText: { color: "white", textAlign: "center", fontWeight: "900", fontSize: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }
});
