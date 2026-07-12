import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { themeForRole } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function AdminHome() {
  const { profile } = useMobileSession();
  const theme = themeForRole(profile?.role);
  const title = profile?.role === "principal" ? "Principal Home" : "Admin Home";

  return (
    <Screen title={title} subtitle="Oversight, people and campus communication">
      <View style={[styles.hero, { backgroundColor: theme.accent }]}>
        <View style={styles.glow} />
        <Text style={styles.eye} allowFontScaling={false}>SCHOOL OVERVIEW</Text>
        <Text style={styles.name} allowFontScaling={false}>Good day, {profile?.displayName ?? "Admin"}</Text>
        <Text style={styles.sub} allowFontScaling={false}>Send daily campus messages to selected teachers or everyone.</Text>
        <Link href="/messages" asChild>
          <Pressable style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={[styles.heroButtonText, { color: theme.accent }]} allowFontScaling={false}>Write message</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.metricRow}>
        <Card style={styles.metric}>
          <Text style={styles.label} allowFontScaling={false}>Students</Text>
          <Text style={styles.value} allowFontScaling={false}>642</Text>
          <Text style={styles.hint} allowFontScaling={false}>18 classes</Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.label} allowFontScaling={false}>Staff present</Text>
          <Text style={[styles.value, styles.good]} allowFontScaling={false}>38/41</Text>
          <Text style={styles.hint} allowFontScaling={false}>Today</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle} allowFontScaling={false}>Quick actions</Text>
        <View style={styles.quickRow}>
          <Link href="/people" asChild>
            <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={styles.quickCode}>PPL</Text><Text style={styles.quickTitle}>People</Text></Pressable>
          </Link>
          <Link href="/messages" asChild>
            <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={styles.quickCode}>MSG</Text><Text style={styles.quickTitle}>Messages</Text></Pressable>
          </Link>
          <Link href="/reports" asChild>
            <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={styles.quickCode}>RPT</Text><Text style={styles.quickTitle}>Reports</Text></Pressable>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", borderRadius: 20, padding: 16, gap: 8 },
  glow: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "white", opacity: 0.12, right: -48, top: -58 },
  eye: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  name: { color: "white", fontSize: 21, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.84)", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  heroButton: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "white", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  heroButtonText: { fontSize: 12, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: { flex: 1 },
  label: { color: "#8a90ac", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  value: { marginTop: 5, color: "#181a2c", fontSize: 24, fontWeight: "900" },
  good: { color: "#12915d" },
  hint: { marginTop: 3, color: "#8a90ac", fontSize: 11, fontWeight: "700" },
  sectionTitle: { color: "#181a2c", fontSize: 16, fontWeight: "900", marginBottom: 12 },
  quickRow: { flexDirection: "row", gap: 9 },
  quick: { flex: 1, minHeight: 82, borderWidth: 1, borderColor: "#e3e6f1", borderRadius: 14, padding: 10 },
  quickCode: { width: 32, height: 30, borderRadius: 9, backgroundColor: "#ecedfb", color: "#33368f", textAlign: "center", paddingTop: 8, fontSize: 9, fontWeight: "900" },
  quickTitle: { marginTop: 9, color: "#181a2c", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] }
});
