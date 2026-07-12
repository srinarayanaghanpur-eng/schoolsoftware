import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { themeForRole } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ParentHome() {
  const { profile } = useMobileSession();
  const theme = themeForRole("parent");

  return (
    <Screen title="Parent Home" subtitle="Fees, exams, notices and school updates">
      <View style={[styles.hero, { backgroundColor: theme.accent }]}>
        <Text style={styles.eye} allowFontScaling={false}>FAMILY PORTAL</Text>
        <Text style={styles.amount} allowFontScaling={false}>Rs 8,000</Text>
        <Text style={styles.sub} allowFontScaling={false}>Term fee due. Signed in as {profile?.displayName ?? "Parent"}.</Text>
      </View>
      <View style={styles.metricRow}>
        <Card style={styles.metric}><Text style={styles.label}>Attendance</Text><Text style={styles.value}>94%</Text><Text style={styles.hint}>This term</Text></Card>
        <Card style={styles.metric}><Text style={styles.label}>Next exam</Text><Text style={styles.value}>FA-2</Text><Text style={styles.hint}>Upcoming</Text></Card>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Latest updates</Text>
        <Text style={styles.helper}>School notices and teacher communication will appear in Messages.</Text>
        <Link href="/messages" asChild><Pressable style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]}><Text style={styles.buttonText}>Open messages</Text></Pressable></Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 16, gap: 5 },
  eye: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  amount: { color: "white", fontSize: 30, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.84)", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: { flex: 1 },
  label: { color: "#8a90ac", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  value: { marginTop: 5, color: "#181a2c", fontSize: 24, fontWeight: "900" },
  hint: { marginTop: 3, color: "#8a90ac", fontSize: 11, fontWeight: "700" },
  sectionTitle: { color: "#181a2c", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  helper: { color: "#575e7d", fontSize: 13, lineHeight: 19, fontWeight: "700", marginBottom: 12 },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] }
});
