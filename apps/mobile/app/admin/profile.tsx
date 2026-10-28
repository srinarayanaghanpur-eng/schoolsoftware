/**
 * Management profile — shared by admin, principal and accountant routes.
 * Stats/menu links are built from the signed-in workspace so every target
 * route exists for that role.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Avatar, BottomSheet, Card, DSText, Icon, PillButton, PressableScale, TonalTile,
  useToast, type IconName
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole, workspaceForRole, workspaceLabel } from "@/lib/roleRouting";
import { displayLoginContact } from "@/lib/text";
import { openWebsite } from "@/lib/openWebsite";
import { AdminShell } from "@/features/admin/shell";
import { formatMoney, useDashboardStats, useTodayAttendance } from "@/features/admin/hooks";
import { initials } from "@/features/teacher/hooks";

export default function AdminProfileRoute() {
  return (
    <AdminShell>
      <WorkspaceProfileScreen />
    </AdminShell>
  );
}

function StatCard({
  value,
  label,
  icon,
  tileBg,
  tileTint,
  accessibilityLabel,
  onPress
}: {
  value: string | number;
  label: string;
  icon: IconName;
  tileBg: string;
  tileTint: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const card = (
    <Card style={styles.moneyCard}>
      <TonalTile bg={tileBg} size={34}>
        <Icon name={icon} size={18} tint={tileTint} />
      </TonalTile>
      <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
        {value}
      </DSText>
      <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>{label}</DSText>
    </Card>
  );

  if (!onPress) return card;

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.moneyPress}
    >
      {card}
    </PressableScale>
  );
}

/** Shared profile screen — reused by principal + accountant routes. */
export function WorkspaceProfileScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const { stats } = useDashboardStats();
  const attendance = useTodayAttendance();

  const name = session.profile?.displayName ?? "Administrator";
  const workspace = workspaceForRole(session.profile?.role);
  const base = dashboardPathForRole(session.profile?.role);

  /**
   * Only link to routes that exist in THIS workspace — an accountant has no
   * /accountant/staff, a principal has no finance route. Building the links
   * from the workspace kind keeps every target reachable.
   */
  const studentsHref =
    workspace === "admin" || workspace === "principal" || workspace === "accountant"
      ? `${base}/students`
      : null;
  const staffHref =
    workspace === "admin" || workspace === "principal" ? `${base}/staff` : null;
  const financeHref =
    workspace === "accountant"
      ? `${base}/collections`
      : workspace === "admin"
        ? `${base}/fees`
        : null;

  const manageLinks: { icon: IconName; title: string; href: string }[] =
    workspace === "accountant"
      ? [
          { icon: "receipt-long", title: "Collections", href: `${base}/collections` },
          { icon: "schedule", title: "Outstanding dues", href: `${base}/dues` }
        ]
      : workspace === "principal"
        ? [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` }
          ]
        : [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` },
            { icon: "payments", title: "Fee collection", href: `${base}/fees` },
            { icon: "campaign", title: "Notices", href: `${base}/notices` }
          ];

  const tileForIndex = (index: number) => {
    const tones = [
      { bg: t.tint, tint: t.blue },
      { bg: t.warnBg, tint: t.warn },
      { bg: t.okBg, tint: t.ok },
      { bg: t.tint, tint: t.blue }
    ];
    return tones[index % tones.length];
  };

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmLogout = () => setConfirmOpen(true);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">{workspaceLabel(session.profile?.role)}</DSText>
          <DSText variant="label">
            {displayLoginContact(session.profile)}
          </DSText>
        </View>
      </View>

      <View style={styles.statRow}>
        <StatCard
          value={stats?.totalStudents ?? 0}
          label="STUDENTS"
          icon="school"
          tileBg={t.tint}
          tileTint={t.blue}
          accessibilityLabel="Open students"
          onPress={studentsHref ? () => router.push(studentsHref as never) : undefined}
        />
        <StatCard
          value={attendance.total}
          label="STAFF"
          icon="groups"
          tileBg={t.tint}
          tileTint={t.blue}
          accessibilityLabel="Open staff directory"
          onPress={staffHref ? () => router.push(staffHref as never) : undefined}
        />
        <StatCard
          value={formatMoney(stats?.monthlyCollection)}
          label="THIS MONTH"
          icon="payments"
          tileBg={t.okBg}
          tileTint={t.ok}
          accessibilityLabel={workspace === "accountant" ? "Open collections" : "Open fee collection"}
          onPress={financeHref ? () => router.push(financeHref as never) : undefined}
        />
      </View>

      <DSText variant="overline">MANAGE</DSText>
      <View style={styles.actionGrid}>
        {manageLinks.map((link, index) => {
          const tile = tileForIndex(index);
          return (
            <PressableScale
              key={link.href}
              accessibilityLabel={link.title}
              onPress={() => router.push(link.href as never)}
              style={styles.actionPress}
            >
              <Card style={styles.actionTile}>
                <TonalTile bg={tile.bg} size={36}>
                  <Icon name={link.icon} size={19} tint={tile.tint} />
                </TonalTile>
                <DSText variant="bodyMedium" numberOfLines={2} style={styles.actionLabel}>{link.title}</DSText>
                <DSText variant="label" tint={t.blue}>
                  Open →
                </DSText>
              </Card>
            </PressableScale>
          );
        })}
      </View>

      <DSText variant="overline">MORE</DSText>
      <View style={styles.actionGrid}>
        <PressableScale
          accessibilityLabel="Reports and exports"
          onPress={() => openWebsite("/admin/reports", "Reports & exports")}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.tint} size={36}>
              <Icon name="insights" size={19} tint={t.blue} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Reports & exports</DSText>
            <DSText variant="label">Opens the website in your browser</DSText>
            <DSText variant="label" tint={t.blue}>
              Open →
            </DSText>
          </Card>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Help and support"
          onPress={() => router.push("/support" as never)}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.warnBg} size={36}>
              <Icon name="help-outline" size={19} tint={t.warn} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Help & support</DSText>
            <DSText variant="label">Contact your administrator</DSText>
            <DSText variant="label" tint={t.blue}>
              Contact →
            </DSText>
          </Card>
        </PressableScale>
      </View>

      <View style={styles.logoutWrap}>
        <PillButton label="Logout from this device" bg={t.bad} fg="#FFFFFF" icon="logout" onPress={confirmLogout} />
      </View>

      <BottomSheet
        visible={confirmOpen}
        title="Log out?"
        onClose={() => setConfirmOpen(false)}
      >
        <DSText variant="label">You are getting logged out from this device.</DSText>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Stay" block onPress={() => setConfirmOpen(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Log out"
              block
              bg={t.bad}
              fg="#FFFFFF"
              onPress={() => { setConfirmOpen(false); void logout(); }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  statRow: { flexDirection: "row", gap: space.sm },
  moneyCard: {
    flex: 1,
    padding: space.md,
    paddingHorizontal: space.sm,
    alignItems: "flex-start",
    gap: 6,
    borderRadius: radius.lg
  },
  moneyValue: { fontSize: 17, fontWeight: "800" },
  moneyLabel: { fontSize: 10 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  moneyPress: { flex: 1 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionPress: { flex: 1, minWidth: "46%" },
  actionTile: { gap: 8 },
  actionLabel: { fontWeight: "700" },
  logoutWrap: { alignItems: "center" }
});
