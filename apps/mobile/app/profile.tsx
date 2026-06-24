import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { auth } from "@/lib/firebase";
import { demoTeachers } from "@sri-narayana/shared";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Profile() {
  const teacher = demoTeachers[0];
  const router = useRouter();
  return (
    <Screen title="Profile" subtitle={teacher.employeeId}>
      <Card>
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
        style={styles.button}
        onPress={() => signOut(auth).then(() => router.replace("/login"))}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: "800", color: "#17211b", marginBottom: 4 },
  muted: { marginBottom: 12, color: "#66736a", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#d6d3d1", marginVertical: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#d6d3d1" },
  detailLabel: { color: "#66736a", fontSize: 13, fontWeight: "600", flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "700", color: "#17211b", textAlign: "right", marginLeft: 8, maxWidth: "60%" },
  button: { backgroundColor: "#047857", padding: 16, borderRadius: 10, marginTop: 8 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }
});
