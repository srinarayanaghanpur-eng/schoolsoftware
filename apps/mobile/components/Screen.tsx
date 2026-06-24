import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export function Screen({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fd" },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32, gap: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#1b1d32", letterSpacing: -0.7 },
  subtitle: { marginTop: 6, color: "#7d86a8", fontSize: 14, fontWeight: "500" }
});
