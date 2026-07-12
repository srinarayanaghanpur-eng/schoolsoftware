import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { themeForRole } from "@/lib/mobileTheme";
import { StyleSheet, Text, View } from "react-native";

export default function Fees() {
  const theme = themeForRole("parent");
  return (
    <Screen title="Fees" subtitle="Parent fee summary">
      <View style={[styles.hero, { backgroundColor: theme.accent }]}>
        <Text style={styles.eye}>AMOUNT DUE</Text>
        <Text style={styles.amount}>Rs 8,000</Text>
        <Text style={styles.sub}>Term 2 fee due soon.</Text>
      </View>
      <Card><Text style={styles.title}>Payment history</Text><Text style={styles.helper}>Detailed fee receipts are available in the web portal.</Text></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 16, gap: 5 },
  eye: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  amount: { color: "white", fontSize: 30, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.84)", fontSize: 13, fontWeight: "700" },
  title: { color: "#181a2c", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  helper: { color: "#575e7d", fontSize: 13, lineHeight: 19, fontWeight: "700" }
});
