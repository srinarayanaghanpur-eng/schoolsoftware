/**
 * ParentShell — the parent workspace chrome (M3 nav bar + toast host).
 * Each parent screen wraps itself in this shell, which makes every screen
 * self-contained: it renders identically whether reached via the app/parent/
 * group or any legacy flat route that still exists on disk pre-cleanup.
 */
import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ToastProvider } from "@/design-system/components";
import { color, radius } from "@/design-system/tokens";

const TABS = [
  { href: "/parent", match: ["/parent", "/parent/index"], icon: "home" as const, label: "Home" },
  { href: "/parent/homework", match: ["/parent/homework"], icon: "menu-book" as const, label: "Homework" },
  { href: "/parent/messages", match: ["/parent/messages"], icon: "chat-bubble" as const, label: "Messages" },
  { href: "/parent/profile", match: ["/parent/profile"], icon: "person" as const, label: "Profile" }
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ToastProvider>
      <View style={styles.root}>
        <View style={{ flex: 1 }}>{children}</View>
        <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {TABS.map((tab) => {
            const active = tab.match.includes(pathname);
            return (
              <Pressable
                key={tab.href}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                onPress={() => { if (!active) router.replace(tab.href as never); }}
                style={({ pressed }) => [styles.navItem, pressed && { transform: [{ scale: 0.93 }] }]}
              >
                <View style={[styles.navPill, active && { backgroundColor: color.primaryContainer }]}>
                  <Icon name={tab.icon} size={21} tint={active ? color.onPrimaryContainer : color.ink2} />
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  navBar: {
    flexDirection: "row",
    backgroundColor: color.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: color.outlineStrong,
    paddingTop: 8,
    paddingHorizontal: 4
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navPill: { width: 56, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: 11, fontWeight: "500", color: color.ink2 },
  navLabelActive: { fontWeight: "700", color: color.ink }
});
