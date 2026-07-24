/**
 * AppShell — the single workspace chrome used by every role.
 * Renders the M3 navigation bar (pill indicator + label), the offline banner
 * and the toast host. Role shells configure it with a tab list; no role
 * defines its own nav styling.
 */
import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Icon, ToastProvider } from "./components";
import { color, radius, space } from "./tokens";

export type ShellTab = {
  href: string;
  /** All pathnames that should light this tab up. */
  match: string[];
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  /** Optional unread/pending count rendered as a nav badge. */
  badge?: number;
};

export function AppShell({
  tabs,
  offline = false,
  children
}: {
  tabs: ShellTab[];
  offline?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ToastProvider>
      <View style={styles.root}>
        {offline ? (
          <View style={[styles.offline, { paddingTop: insets.top + space.xs }]}>
            <Icon name="cloud-off" size={14} tint={color.onPrimary} />
            <Text style={styles.offlineText}>Offline — changes will sync automatically</Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>{children}</View>

        <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {tabs.map((tab) => {
            const active = tab.match.includes(pathname);
            return (
              <Pressable
                key={tab.href}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  tab.badge ? `${tab.label}, ${tab.badge} pending` : tab.label
                }
                onPress={() => {
                  if (!active) router.replace(tab.href as never);
                }}
                style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              >
                <View style={styles.pillWrap}>
                  <View style={[styles.navPill, active && styles.navPillActive]}>
                    <Icon
                      name={tab.icon}
                      size={21}
                      tint={active ? color.onPrimaryContainer : color.ink2}
                    />
                  </View>
                  {tab.badge && tab.badge > 0 ? (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>
                        {tab.badge > 9 ? "9+" : String(tab.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
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
  offline: {
    backgroundColor: color.inverseSurface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs + 2,
    paddingBottom: 6
  },
  offlineText: { color: color.onPrimary, fontSize: 12, fontWeight: "500" },
  navBar: {
    flexDirection: "row",
    backgroundColor: color.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: color.outlineStrong,
    paddingTop: 8,
    paddingHorizontal: 4
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navItemPressed: { transform: [{ scale: 0.93 }] },
  pillWrap: { position: "relative" },
  navPill: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  navPillActive: { backgroundColor: color.primaryContainer },
  navBadge: {
    position: "absolute",
    top: -2,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: color.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  navBadgeText: { color: color.onPrimary, fontSize: 9.5, fontWeight: "700" },
  navLabel: { fontSize: 11, fontWeight: "500", color: color.ink2 },
  navLabelActive: { fontWeight: "700", color: color.ink }
});
