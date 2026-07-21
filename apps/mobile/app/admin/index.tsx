/**
 * Admin Home — today's snapshot, per the approved Admin App design.
 * All figures come from /api/admin/* (server-side RBAC); nothing is hardcoded.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, ErrorState, Hero, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { AdminShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useDashboardStats, useLeaveRequests,
  useRecentPayments, useTodayAttendance
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "fees", icon: "payments" as const, label: "Fees", href: "/admin/fees" },
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/admin/staff" },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/admin/approvals" },
  { key: "notices", icon: "campaign" as const, label: "Notices", href: "/admin/notices" }
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
          <DSText variant="display" tint={color.onPrimary} style={{ fontSize: 26 }}>
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

      {/* today snapshot */}
      <View style={styles.statRow}>
        <StatTile value={stats?.totalStudents ?? 0} label="Students" tint={color.primary} />
        <StatTile
          value={`${attendance.present}/${attendance.total}`}
          label="Staff present"
          tint={color.success}
        />
        <StatTile
          value={formatMoneyShort(stats?.totalFeeOutstanding)}
          label="Outstanding"
          tint={color.error}
        />
      </View>

      {/* fee collection progress */}
      <SectionCard heading="FEE COLLECTION">
        <ProgressRow
          label="Collected against demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
        <ListRow
          leading={<TonalTile bg={color.successContainer}><Icon name="trending-up" size={19} tint={color.success} /></TonalTile>}
          title={formatMoney(stats?.totalFeeCollected)}
          subtitle="Total collected"
        />
        <ListRow
          leading={<TonalTile bg={color.errorContainer}><Icon name="error-outline" size={19} tint={color.error} /></TonalTile>}
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
          pendingLeave.slice(0, 3).map((request) => (
            <ListRow
              key={request.id}
              leading={<TonalTile bg={color.warningContainer}><Icon name="flight-takeoff" size={19} tint={color.warning} /></TonalTile>}
              title={request.teacherName ?? "Staff leave request"}
              subtitle={`${request.leaveType ?? "Leave"} · ${formatDate(request.fromDate)}`}
              chevron
              onPress={() => router.push("/admin/approvals" as never)}
            />
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
            <Icon name={action.icon} size={22} tint={color.primary} />
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {/* recent payments */}
      <SectionCard heading="RECENT PAYMENTS">
        {payments.length === 0 ? (
          <DSText variant="label">No payments recorded yet today.</DSText>
        ) : (
          payments.slice(0, 4).map((payment) => (
            <ListRow
              key={payment.id}
              leading={<TonalTile bg={color.successContainer}><Icon name="check" size={19} tint={color.success} /></TonalTile>}
              title={payment.studentName ?? "Payment"}
              subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
              trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
            />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  }
});
