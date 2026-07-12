import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { palette, themeForRole } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";
import { StyleSheet, Text, View } from "react-native";

export default function Reports() {
  const { profile } = useMobileSession();
  const theme = themeForRole(profile?.role);

  return (
    <Screen title="Reports" subtitle="Mobile summary">
      <View style={styles.grid}>
        {["Attendance", "Fees", "Staff", "Messages"].map((item) => (
          <Card key={item} style={styles.tile}>
            <Text style={[styles.code, { color: theme.accent }]}>{item.slice(0, 3).toUpperCase()}</Text>
            <Text style={styles.title}>{item}</Text>
            <Text style={styles.helper}>Open the web dashboard for full exports and detailed reports.</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%" },
  code: { fontSize: 11, fontWeight: "900", marginBottom: 8 },
  title: { color: palette.ink, fontSize: 15, fontWeight: "900" },
  helper: { marginTop: 5, color: palette.ink2, fontSize: 11, lineHeight: 16, fontWeight: "700" }
});
