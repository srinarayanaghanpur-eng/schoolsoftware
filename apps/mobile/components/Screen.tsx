import { OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { palette, themeForRole } from "@/lib/mobileTheme";
import { useMobileSession } from "@/lib/mobileSession";
import type { Role } from "@sri-narayana/shared";
import { Link, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NavItem = { href: string; label: string; glyph: string };

const TEACHER_NAV: NavItem[] = [
  { href: "/home", label: "Home", glyph: "H" },
  { href: "/attendance", label: "Attend", glyph: "A" },
  { href: "/messages", label: "Messages", glyph: "M" },
  { href: "/history", label: "History", glyph: "L" },
  { href: "/profile", label: "Me", glyph: "Me" }
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Home", glyph: "H" },
  { href: "/people", label: "People", glyph: "P" },
  { href: "/messages", label: "Messages", glyph: "M" },
  { href: "/reports", label: "Reports", glyph: "R" },
  { href: "/profile", label: "More", glyph: "..." }
];

const PARENT_NAV: NavItem[] = [
  { href: "/parent", label: "Home", glyph: "H" },
  { href: "/fees", label: "Fees", glyph: "Rs" },
  { href: "/messages", label: "Messages", glyph: "M" },
  { href: "/reports", label: "Reports", glyph: "R" },
  { href: "/profile", label: "Me", glyph: "Me" }
];

const ACCOUNTANT_NAV: NavItem[] = [
  { href: "/accountant", label: "Home", glyph: "H" },
  { href: "/payments", label: "Payments", glyph: "Rs" },
  { href: "/messages", label: "Messages", glyph: "M" },
  { href: "/reports", label: "Reports", glyph: "R" },
  { href: "/profile", label: "Salary", glyph: "S" }
];

function navForRole(role?: Role): NavItem[] {
  if (role === "admin" || role === "principal" || role === "super_admin") return ADMIN_NAV;
  if (role === "parent") return PARENT_NAV;
  if (role === "accountant") return ACCOUNTANT_NAV;
  return TEACHER_NAV;
}

// Tablets (iPad portrait is 768pt wide) get a side rail + centred content column
// instead of the phone's bottom tab bar.
const TABLET_BREAKPOINT = 768;

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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const redirectedRef = useRef(false);
  const session = useMobileSession();
  const roleTheme = themeForRole(session.profile?.role);
  const navItems = useMemo(() => navForRole(session.profile?.role), [session.profile?.role]);
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!isLogin && !redirectedRef.current && session.status === "unauthenticated") {
      redirectedRef.current = true;
      router.replace("/login");
    }
  }, [isLogin, router, session.status]);

  if (!isLogin && session.status === "checking") {
    return (
      <View style={styles.flex}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={roleTheme.accent} />
          <Text style={styles.loaderText} allowFontScaling={false}>Opening workspace...</Text>
        </View>
      </View>
    );
  }

  const header = (
    <View style={[styles.header, isTablet && styles.headerTablet]}>
      <Text style={[styles.title, isTablet && styles.titleTablet]} allowFontScaling={false}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]} allowFontScaling={false}>{subtitle}</Text> : null}
    </View>
  );

  // ---------- Tablet: fixed side rail + centred scrolling content ----------
  if (isTablet) {
    return (
      <View style={styles.flex}>
        <View style={styles.tabletRoot}>
          <View style={[styles.rail, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.railBrand}>
              <View style={[styles.railBadge, { backgroundColor: roleTheme.tint }]}>
                <Text style={[styles.railBadgeText, { color: roleTheme.accent }]} allowFontScaling={false}>{roleTheme.short}</Text>
              </View>
              <View style={styles.railBrandCopy}>
                <Text style={styles.railBrandName} allowFontScaling={false}>Sri Narayana</Text>
                <Text style={styles.railBrandSub} allowFontScaling={false}>{roleTheme.label} workspace</Text>
              </View>
            </View>
            <View style={styles.railNav}>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href as never} asChild>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.label}`}
                      style={({ pressed }) => [styles.railItem, active && { backgroundColor: roleTheme.tint }, pressed && styles.pressed]}
                    >
                      <View style={[styles.railIconWrap, { backgroundColor: active ? roleTheme.accent : palette.surface2 }]}>
                        <Text style={[styles.railIcon, active && styles.railIconActive]} allowFontScaling={false}>{item.glyph}</Text>
                      </View>
                      <Text style={[styles.railLabel, active && { color: roleTheme.accent }]} allowFontScaling={false}>{item.label}</Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
          <View style={styles.tabletMain}>
            <ScrollView contentContainerStyle={styles.tabletScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <View style={styles.contentColumn}>
                {header}
                {children}
              </View>
            </ScrollView>
          </View>
        </View>
        <OfflineStatusIndicator />
      </View>
    );
  }

  // ---------- Phone: top bar + bottom tab bar ----------
  return (
    <View style={styles.flex}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand} allowFontScaling={false}>Sri Narayana</Text>
          <Text style={styles.brandSubtext} allowFontScaling={false}>{roleTheme.label} workspace</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleTheme.tint }]}>
          <Text style={[styles.roleBadgeText, { color: roleTheme.accent }]} allowFontScaling={false}>{roleTheme.short}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {header}
        {children}
      </ScrollView>
      <OfflineStatusIndicator />
      <View style={[styles.bottomNav, { marginBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href as never} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                style={({ pressed }) => [styles.navItem, active && styles.navItemActive, pressed && styles.pressed]}
              >
                <View style={[styles.navIconWrap, active && { backgroundColor: roleTheme.accent }]}>
                  <Text style={[styles.navIcon, active && styles.navIconActive]} allowFontScaling={false}>{item.glyph}</Text>
                </View>
                <Text style={[styles.navLabel, active && { color: roleTheme.accent }]} allowFontScaling={false}>{item.label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.ground },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loaderText: { color: palette.ink2, fontSize: 13, fontWeight: "800" },

  // shared header
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: palette.ink, letterSpacing: 0 },
  subtitle: { marginTop: 6, color: palette.ink2, fontSize: 14, fontWeight: "500" },
  headerTablet: { marginBottom: 14 },
  titleTablet: { fontSize: 34, letterSpacing: -0.4 },
  subtitleTablet: { fontSize: 16, marginTop: 8 },

  // ---- phone top bar ----
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  brand: { color: palette.brand, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  brandSubtext: { marginTop: 2, color: palette.ink3, fontSize: 12, fontWeight: "700" },
  roleBadge: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  roleBadgeText: { fontSize: 11, fontWeight: "900" },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 16, flexGrow: 1 },

  // ---- phone bottom nav ----
  bottomNav: {
    marginHorizontal: 12,
    padding: 6,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 1
  },
  navItemActive: { backgroundColor: palette.surface2 },
  navIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center"
  },
  navIcon: { color: "#8a93b2", fontSize: 10, fontWeight: "900" },
  navIconActive: { color: "white", fontSize: 10, fontWeight: "900" },
  navLabel: { color: palette.ink3, fontSize: 10, fontWeight: "800" },

  // ---- tablet layout ----
  tabletRoot: { flex: 1, flexDirection: "row" },
  rail: {
    width: 248,
    backgroundColor: palette.surface,
    borderRightWidth: 1,
    borderRightColor: palette.line,
    paddingHorizontal: 16
  },
  railBrand: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 26 },
  railBadge: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  railBadgeText: { fontSize: 14, fontWeight: "900" },
  railBrandCopy: { flex: 1 },
  railBrandName: { color: palette.brand, fontSize: 15, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" },
  railBrandSub: { marginTop: 2, color: palette.ink3, fontSize: 12, fontWeight: "700" },
  railNav: { gap: 6 },
  railItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 14 },
  railIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  railIcon: { color: "#8a93b2", fontSize: 12, fontWeight: "900" },
  railIconActive: { color: "white" },
  railLabel: { color: palette.ink2, fontSize: 14, fontWeight: "800" },

  tabletMain: { flex: 1 },
  tabletScroll: { paddingHorizontal: 28, paddingVertical: 28, alignItems: "center", flexGrow: 1 },
  contentColumn: { width: "100%", maxWidth: 780, gap: 16 },

  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }
});
