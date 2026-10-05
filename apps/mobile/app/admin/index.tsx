/**
 * Admin Home — today's snapshot, per the approved Admin App design.
 * All figures come from /api/admin/* (server-side RBAC); nothing is hardcoded.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, Card, DSText, ErrorState, Hero, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { AdminShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, formatText, useDashboardStats, useLeaveRequests,
  useRecentPayments, useTodayAttendance
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "fees", icon: "payments" as const, label: "Fees", href: "/admin/fees", tile: color.tileMint, tint: color.success },
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/admin/staff", tile: color.tileSky, tint: color.primary },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/admin/approvals", tile: color.tilePeach, tint: color.warning },
  { key: "notices", icon: "campaign" as const, label: "Notices", href: "/admin/notices", tile: color.tileLavender, tint: color.primary }
];

export default function AdminHomeRoute() {
  return (
    <AdminShell>
      <AdminHome />
    </AdminShell>
  );
}

function AdminHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useMobileSession();
  const { stats, loading, error, refresh } = useDashboardStats();
  const attendance = useTodayAttendance();
  const { payments } = useRecentPayments();
  const { requests } = useLeaveRequests();

  if (loading && !stats) return <LoadingState label="Loading today’s snapshot…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Administrator";
  const pendingLeave = requests.filter((r) => r.status === "pending");
  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/admin/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={color.accountPurple} />
          </PressableScale>
        }
      />

      {/* collections hero */}
      <Hero>
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText variant="caption" tint={color.onPrimary} style={{ opacity: 0.8 }}>
            COLLECTED THIS MONTH
          </DSText>
          <DSText variant="display" tint={color.onPrimary} style={styles.heroMoney}>
            {formatMoney(stats?.monthlyCollection)}
          </DSText>
        </View>
        <PillButton
          label="Details"
          bg={color.surface}
          fg={color.onPrimaryContainer}
          onPress={() => router.push("/admin/fees" as never)}
        />
      </Hero>

      {/* today snapshot — pastel-tile money cards */}
      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileSky} size={36}>
            <Icon name="groups" size={19} tint={color.primary} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileMint} size={36}>
            <Icon name="how-to-reg" size={19} tint={color.success} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {`${attendance.present}/${attendance.total}`}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>PRESENT</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileRose} size={36}>
            <Icon name="error-outline" size={19} tint={color.error} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeOutstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
      </View>

      {/* fee collection progress */}
      <SectionCard heading="FEE COLLECTION">
        <ProgressRow
          label="Collected against demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
        <View style={styles.divider} />
        <ListRow
          leading={<TonalTile bg={color.tileMint}><Icon name="trending-up" size={19} tint={color.success} /></TonalTile>}
          title={formatMoney(stats?.totalFeeCollected)}
          subtitle="Total collected"
        />
        <View style={styles.divider} />
        <ListRow
          leading={<TonalTile bg={color.tileRose}><Icon name="error-outline" size={19} tint={color.error} /></TonalTile>}
          title={`${stats?.studentsWithOutstandingFees ?? 0} students with dues`}
          subtitle={`${formatMoney(stats?.totalFeeOutstanding)} outstanding`}
          chevron
          onPress={() => router.push("/admin/fees" as never)}
        />
      </SectionCard>

      {/* approvals */}
      <SectionCard
        heading="PENDING APPROVALS"
        trailing={pendingLeave.length > 0 ? <Badge label={`${pendingLeave.length}`} /> : undefined}
      >
        {pendingLeave.length === 0 ? (
          <DSText variant="label">Nothing waiting on you. All caught up.</DSText>
        ) : (
          pendingLeave.slice(0, 3).map((request, index) => (
            <View key={request.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<TonalTile bg={color.tilePeach}><Icon name="flight-takeoff" size={19} tint={color.warning} /></TonalTile>}
                title={formatText(request.teacherName, "Staff leave request")}
                subtitle={`${formatText(request.leaveType, "Leave")} · ${formatDate(request.fromDate)}`}
                chevron
                onPress={() => router.push("/admin/approvals" as never)}
              />
            </View>
          ))
        )}
      </SectionCard>

      {/* quick actions */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <PressableScale
            key={action.key}
            accessibilityLabel={action.label}
            onPress={() => router.push(action.href as never)}
            style={styles.quickTile}
          >
            <TonalTile bg={action.tile} size={38}>
              <Icon name={action.icon} size={22} tint={action.tint} />
            </TonalTile>
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {/* recent payments */}
      <SectionCard heading="RECENT PAYMENTS">
        {payments.length === 0 ? (
          <DSText variant="label">No payments recorded yet today.</DSText>
        ) : (
          payments.slice(0, 4).map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<TonalTile bg={color.tileMint}><Icon name="check" size={19} tint={color.success} /></TonalTile>}
                title={formatText(payment.studentName, "Payment")}
                subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
              />
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  heroMoney: { fontSize: 26, fontWeight: "800" },
  statRow: { flexDirection: "row", gap: 10 },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.outline },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm,
    ...elevation.card
  }
});
