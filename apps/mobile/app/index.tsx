import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { dashboardPathForRole, palette } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";

export default function Index() {
  const session = useMobileSession();

  if (session.status === "authenticated" && session.profile) {
    return <Redirect href={dashboardPathForRole(session.profile.role) as never} />;
  }

  if (session.status === "checking") {
    return (
      <View style={styles.page}>
        <ActivityIndicator size="large" color={palette.brand} />
        <Text style={styles.text} allowFontScaling={false}>Opening workspace...</Text>
      </View>
    );
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.ground, gap: 12 },
  text: { color: palette.ink2, fontSize: 13, fontWeight: "800" }
});
