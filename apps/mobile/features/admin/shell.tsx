/**
 * Workspace shells for the management roles.
 * Tab sets mirror the approved Admin and Principal App designs.
 * Zepto-style tab bar: white bar, pastel tile wash behind inactive icons,
 * primary pill highlight on the active tab.
 */
import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ToastProvider } from "@/design-system/components";
import { color, radius } from "@/design-system/tokens";
import type { ShellTab } from "@/design-system/shell";

const ADMIN_TABS: ShellTab[] = [
  { href: "/admin", match: ["/admin", "/admin/index"], icon: "home", label: "Home" },
  { href: "/admin/fees", match: ["/admin/fees"], icon: "receipt-long", label: "Fees" },
  { href: "/admin/notices", match: ["/admin/notices"], icon: "campaign", label: "Notices" },
  { href: "/admin/profile", match: ["/admin/profile"], icon: "person", label: "Profile" }
];

const PRINCIPAL_TABS: ShellTab[] = [
  { href: "/principal", match: ["/principal", "/principal/index"], icon: "home", label: "Home" },
  { href: "/principal/approvals", match: ["/principal/approvals"], icon: "task-alt", label: "Verify" },
  { href: "/principal/staff", match: ["/principal/staff"], icon: "group", label: "Staff" },
  { href: "/principal/profile", match: ["/principal/profile"], icon: "person", label: "Profile" }
];

const ACCOUNTANT_TABS: ShellTab[] = [
  { href: "/accountant", match: ["/accountant", "/accountant/index"], icon: "dashboard", label: "Home" },
  { href: "/accountant/collections", match: ["/accountant/collections"], icon: "receipt-long", label: "Collections" },
  { href: "/accountant/dues", match: ["/accountant/dues"], icon: "schedule", label: "Dues" },
  { href: "/accountant/profile", match: ["/accountant/profile"], icon: "person-outline", label: "Profile" }
];

/** Zepto-style pastel tile wash behind each inactive tab icon. */
const TILE_ORDER = [
  color.tileLavender,
  color.tilePeach,
  color.tileMint,
  color.tileSky,
  color.tileRose,
  color.tileLemon,
] as const;

function ZeptoShell({ tabs, children }: { tabs: ShellTab[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ToastProvider>
      <View style={styles.root}>
        <View style={{ flex: 1 }}>{children}</View>
        <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {tabs.map((tab, index) => {
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
                style={({ pressed }) => [styles.navItem, pressed && { transform: [{ scale: 0.93 }] }]}
              >
                <View style={styles.pillWrap}>
                  <View
                    style={[
                      styles.navPill,
                      { backgroundColor: active ? color.primary : TILE_ORDER[index % TILE_ORDER.length] },
                    ]}
                  >
                    <Icon
                      name={tab.icon}
                      size={21}
                      tint={active ? color.onPrimary : color.ink}
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <ZeptoShell tabs={ADMIN_TABS}>{children}</ZeptoShell>;
}

export function PrincipalShell({ children }: { children: React.ReactNode }) {
  return <ZeptoShell tabs={PRINCIPAL_TABS}>{children}</ZeptoShell>;
}

export function AccountantShell({ children }: { children: React.ReactNode }) {
  return <ZeptoShell tabs={ACCOUNTANT_TABS}>{children}</ZeptoShell>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  navBar: {
    flexDirection: "row",
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.outline,
    paddingTop: 10,
    paddingHorizontal: 6
  },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  pillWrap: { position: "relative" },
  navPill: {
    width: 58,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
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
  navLabel: { fontSize: 10.5, fontWeight: "500", color: color.ink2 },
  navLabelActive: { fontWeight: "800", color: color.primary }
});
