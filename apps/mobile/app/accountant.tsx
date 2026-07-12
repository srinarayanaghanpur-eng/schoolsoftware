import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { themeForRole } from "@/lib/mobileTheme";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function AccountantHome() {
  const theme = themeForRole("accountant");

  return (
    <Screen title="Accounts Home" subtitle="Collections, dues and salary overview">
      <View style={[styles.hero, { backgroundColor: theme.accent }]}>
        <Text style={styles.eye} allowFontScaling={false}>COLLECTED TODAY</Text>
        <Text style={styles.amount} allowFontScaling={false}>Rs 1,51,000</Text>
        <Text style={styles.sub} allowFontScaling={false}>28 receipts recorded today.</Text>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Collection by method</Text>
        <View style={styles.bars}>
          {["Cash", "Online", "UPI", "Cheque"].map((item, index) => <View key={item} style={styles.barColumn}><View style={[styles.bar, { height: [58, 24, 18, 10][index], backgroundColor: index === 0 ? theme.accent : "#33368f" }]} /><Text style={styles.barLabel}>{item}</Text></View>)}
        </View>
      </Card>
      <Link href="/payments" asChild><Pressable style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]}><Text style={styles.buttonText}>Record payment</Text></Pressable></Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 16, gap: 5 },
  eye: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  amount: { color: "white", fontSize: 30, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.84)", fontSize: 13, fontWeight: "700" },
  sectionTitle: { color: "#181a2c", fontSize: 16, fontWeight: "900", marginBottom: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 12, height: 88 },
  barColumn: { flex: 1, alignItems: "center", gap: 6 },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: { color: "#8a90ac", fontSize: 10, fontWeight: "800" },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] }
});
