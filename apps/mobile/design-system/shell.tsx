/**
 * Shared workspace chrome (reference: school-dashboards-v2.html).
 *
 * AppHeader: mark tile + school name + role subtitle + dark-mode toggle.
 * AppShell: DOCKED glass nav bar — full-width bar with an active-tab tint
 * pill, its glass background reaching the screen bottom so there is no gap,
 * with safe-area padding inside. Role shells pass their tab list; no role
 * defines its own nav styling. The bar is absolutely positioned over a
 * spacer so it never covers screen content.
 */
import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { DSText, Icon, ToastProvider } from "./components";
import { space } from "./tokens";
import { useTheme } from "@/lib/Theme";

export type ShellTab = {
  href: string;
  /** All pathnames that should light this tab up. */
  match: string[];
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  /** Optional unread/pending count rendered as a nav badge. */
  badge?: number;
};

export function AppHeader({ subtitle }: { subtitle: string }) {
  const { t, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: t.card,
        borderBottomWidth: 1,
        borderBottomColor: t.line,
        paddingHorizontal: 18,
        paddingTop: insets.top + 14,
        paddingBottom: 12
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image
          source={require("../assets/LOGO.png")}
          style={{ width: 40, height: 40 }}
          resizeMode="contain"
          accessibilityLabel="Sri Narayana High School logo"
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText numberOfLines={1} style={{ fontSize: 15, fontWeight: "800" }}>
            Sri Narayana High School
          </DSText>
          <DSText numberOfLines={1} style={{ fontSize: 11 }}>
            {subtitle}
          </DSText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dark ? "Switch to light mode" : "Switch to dark mode"}
          onPress={toggle}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.card,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon name={dark ? "light-mode" : "dark-mode"} size={20} tint={t.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function AppShell({
  tabs,
  header,
  offline = false,
  children
}: {
  tabs: ShellTab[];
  header?: React.ReactNode;
  offline?: boolean;
  children: React.ReactNode;
}) {
  const { t, dark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ToastProvider>
      <View style={[styles.root, { backgroundColor: t.bg }]}>
        {header}
        {offline ? (
          <View style={[styles.offline, { paddingTop: insets.top + space.xs }]}>
            <Icon name="cloud-off" size={14} tint="#FFFFFF" />
            <Text style={styles.offlineText}>Offline — changes will sync automatically</Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>{children}</View>

        {/* reserve: the docked bar overlays this empty zone, never content */}
        <View style={{ height: Math.max(insets.bottom, 10) + 78, backgroundColor: t.bg }} />

        <View pointerEvents="box-none" style={styles.dockZone}>
          <View
            style={[
              styles.dockShadow,
              {
                shadowColor: dark ? "#000000" : t.blue,
                backgroundColor: dark ? "rgba(22,18,44,0.55)" : "rgba(255,255,255,0.62)"
              }
            ]}
          >
            <BlurView
              intensity={dark ? 45 : 60}
              tint={dark ? "dark" : "light"}
              style={[
                styles.dockBar,
                { borderColor: t.line, paddingBottom: Math.max(insets.bottom, 10) }
              ]}
            >
              <View style={styles.dockRow}>
                {tabs.map((tab) => {
                  const active = tab.match.includes(pathname);
                  return (
                    <Pressable
                      key={tab.href}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge} pending` : tab.label}
                      onPress={() => {
                        if (!active) router.replace(tab.href as never);
                      }}
                      style={styles.navItem}
                    >
                      <View style={[styles.tabPill, active && { backgroundColor: t.tint }]}>
                        <View style={styles.iconWrap}>
                          <Icon name={tab.icon} size={22} tint={active ? t.blue : t.faint} />
                          {tab.badge && tab.badge > 0 ? (
                            <View style={styles.navBadge}>
                              <Text style={styles.navBadgeText}>{tab.badge > 9 ? "9+" : String(tab.badge)}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.navLabel, { color: active ? t.blue : t.faint }, active && styles.navLabelActive]}
                        >
                          {tab.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </BlurView>
          </View>
        </View>
      </View>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offline: {
    backgroundColor: "#221d33",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 6
  },
  offlineText: { color: "#FFFFFF", fontSize: 12, fontWeight: "500" },
  dockZone: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  },
  dockShadow: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10
  },
  dockBar: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: "hidden"
  },
  dockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  tabPill: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 20
  },
  iconWrap: { position: "relative" },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C93A3F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  navBadgeText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "700" },
  navLabel: { fontSize: 11, fontWeight: "600" },
  navLabelActive: { fontWeight: "700" }
});
