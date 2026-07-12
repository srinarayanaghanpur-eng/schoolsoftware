import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { themeForRole } from "@/lib/mobileTheme";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function Payments() {
  const theme = themeForRole("accountant");
  return (
    <Screen title="Payments" subtitle="Fast mobile entry">
      <Card>
        <Text style={styles.title}>Record payment</Text>
        <TextInput style={styles.input} placeholder="Student name or admission no." placeholderTextColor="#8a90ac" />
        <TextInput style={styles.input} placeholder="Amount" placeholderTextColor="#8a90ac" keyboardType="numeric" />
        <View style={styles.row}>
          {["Cash", "UPI", "Online"].map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}
        </View>
        <Pressable style={[styles.button, { backgroundColor: theme.accent }]}><Text style={styles.buttonText}>Save draft</Text></Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: "#181a2c", fontSize: 17, fontWeight: "900", marginBottom: 12 },
  input: { backgroundColor: "#f8f9ff", borderWidth: 1, borderColor: "#e3e6f1", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 10, color: "#181a2c", fontSize: 14, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, backgroundColor: "#e2f4ea", paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: "#14764c", fontSize: 12, fontWeight: "900" },
  button: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontSize: 15, fontWeight: "900" }
});
