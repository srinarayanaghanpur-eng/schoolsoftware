import { auth } from "@/lib/firebase";
import { Link, usePathname, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const NAV_ITEMS = [
  { href: "/home", label: "Home", short: "HM" },
  { href: "/attendance", label: "Mark", short: "AT" },
  { href: "/calendar", label: "Calendar", short: "CL" },
  { href: "/history", label: "History", short: "LG" },
  { href: "/profile", label: "Profile", short: "ME" }
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
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      setLoggingOut(false);
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>Sri Narayana</Text>
          <Text style={styles.brandSubtext}>Teacher App</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Logout"
          disabled={loggingOut}
          onPress={logout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed, loggingOut && styles.disabled]}
        >
          <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Logout"}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}
              >
                <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.short}</Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fd" },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  brand: { color: "#3033a1", fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  brandSubtext: { marginTop: 2, color: "#7d86a8", fontSize: 12, fontWeight: "700" },
  logoutButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe3f2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#242a5e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1
  },
  logoutText: { color: "#3033a1", fontSize: 13, fontWeight: "900" },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#1b1d32", letterSpacing: -0.7 },
  subtitle: { marginTop: 6, color: "#7d86a8", fontSize: 14, fontWeight: "500" },
  bottomNav: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 8,
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
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  navItemActive: { backgroundColor: "#eeefff" },
  navIcon: { color: "#8a93b2", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  navIconActive: { color: "#3033a1" },
  navLabel: { color: "#7d86a8", fontSize: 10, fontWeight: "800" },
  navLabelActive: { color: "#3033a1" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 }
});
