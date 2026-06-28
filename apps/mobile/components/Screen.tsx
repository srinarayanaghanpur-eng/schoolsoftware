import { OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { usePathname } from "expo-router";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NAV_ITEMS = [
  { href: "/home", label: "Home", glyph: "Hm" },
  { href: "/attendance", label: "Mark", glyph: "Mk" },
  { href: "/calendar", label: "Calendar", glyph: "Ca" },
  { href: "/history", label: "History", glyph: "Hi" },
  { href: "/profile", label: "Profile", glyph: "Pr" }
] as const;

export function Screen({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand} allowFontScaling={false}>Sri Narayana</Text>
          <Text style={styles.brandSubtext} allowFontScaling={false}>Teacher App</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={styles.header}>
          <Text style={styles.title} allowFontScaling={false}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} allowFontScaling={false}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
      <OfflineStatusIndicator />
      <View style={[styles.bottomNav, { marginBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}
              >
                <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                  <Text style={[styles.navIcon, active && styles.navIconActive]} allowFontScaling={false}>{item.glyph}</Text>
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]} allowFontScaling={false}>{item.label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f6fd" },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  brand: { color: "#3033a1", fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  brandSubtext: { marginTop: 2, color: "#7d86a8", fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 16, flexGrow: 1 },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#1b1d32", letterSpacing: -0.7 },
  subtitle: { marginTop: 6, color: "#7d86a8", fontSize: 14, fontWeight: "500" },
  bottomNav: {
    marginHorizontal: 12,
    padding: 6,
    borderRadius: 24,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e3e6f0",
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#242a5e",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6
  },
  navItem: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 1
  },
  navItemActive: { backgroundColor: "#eeefff" },
  navIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  navIconWrapActive: { backgroundColor: "#3033a1" },
  navIcon: { color: "#8a93b2", fontSize: 10, fontWeight: "900" },
  navIconActive: { color: "white", fontSize: 10, fontWeight: "900" },
  navLabel: { color: "#7d86a8", fontSize: 10, fontWeight: "800" },
  navLabelActive: { color: "#3033a1" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }
});
