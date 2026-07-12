import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { palette, themeForRole } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} allowFontScaling={false}>{label}</Text>
      <Text style={styles.detailValue} allowFontScaling={false}>{value || "--"}</Text>
    </View>
  );
}

function TeacherProfileCard() {
  const { teacher, loading, error } = useTeacherAttendanceData();

  if (loading) {
    return <Card><Text style={styles.emptyText} allowFontScaling={false}>Loading profile...</Text></Card>;
  }

  if (error || !teacher) {
    return <Card><Text style={styles.errorText} allowFontScaling={false}>{error ?? "Teacher profile not found."}</Text></Card>;
  }

  return (
    <Card style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.avatarText} allowFontScaling={false}>{initials(teacher.fullName)}</Text></View>
      <Text style={styles.name} allowFontScaling={false}>{teacher.fullName}</Text>
      <Text style={styles.muted} allowFontScaling={false}>{teacher.subject}</Text>
      <View style={styles.divider} />
      <DetailRow label="Employee ID" value={teacher.employeeId} />
      <DetailRow label="Phone" value={teacher.phone} />
      <DetailRow label="Biometric ID" value={teacher.biometricUserId} />
    </Card>
  );
}

export default function Profile() {
  const router = useRouter();
  const session = useMobileSession();
  const profile = session.profile;
  const theme = themeForRole(profile?.role);

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <Screen title="Profile" subtitle={profile?.employeeId ?? profile?.email ?? "Signed-in user"}>
      {profile?.role === "teacher" ? (
        <TeacherProfileCard />
      ) : (
        <Card style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: theme.tint }]}><Text style={[styles.avatarText, { color: theme.accent }]}>{initials(profile?.displayName ?? theme.label)}</Text></View>
          <Text style={styles.name} allowFontScaling={false}>{profile?.displayName ?? theme.label}</Text>
          <Text style={styles.muted} allowFontScaling={false}>{profile?.role ? ROLE_LABELS[profile.role] : "User"}</Text>
          <View style={styles.divider} />
          <DetailRow label="Login ID" value={profile?.employeeId} />
          <DetailRow label="Email" value={profile?.email ?? profile?.internalEmail} />
          <DetailRow label="Workspace" value={theme.label} />
        </Card>
      )}
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]} onPress={logout}>
        <Text style={styles.buttonText} allowFontScaling={false}>Logout from this device</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 20, backgroundColor: "#f7c548", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarText: { color: "#2b2d82", fontSize: 19, fontWeight: "900" },
  name: { fontSize: 24, fontWeight: "900", color: palette.ink, marginBottom: 4, textAlign: "center" },
  muted: { marginBottom: 12, color: palette.ink2, fontSize: 14, fontWeight: "700", textAlign: "center" },
  divider: { alignSelf: "stretch", height: 1, backgroundColor: palette.line, marginVertical: 12 },
  detailRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#eef1f8" },
  detailLabel: { color: palette.ink2, fontSize: 13, fontWeight: "800", flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "900", color: palette.ink, textAlign: "right", marginLeft: 8, maxWidth: "60%" },
  emptyText: { color: palette.ink2, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  errorText: { color: palette.bad, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  button: { padding: 16, borderRadius: 16, marginTop: 2, minHeight: 54, justifyContent: "center" },
  buttonText: { color: "white", textAlign: "center", fontWeight: "900", fontSize: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }
});
