/**
 * Admin Home — today's snapshot, per the approved Admin App design.
 * All figures come from /api/admin/* (server-side RBAC); nothing is hardcoded.
 */
import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, Badge, Card, DSText, ErrorState, Icon, ListRow, SkeletonPage,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile
} from "@/design-system/components";
import { BarChart } from "@/design-system/widgets";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { asDateString } from "@/lib/text";
import { useMobileSession } from "@/lib/mobileSession";
import { AdminShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, formatText, useDashboardStats, useExpenses, useLeaveRequests,
  useRecentPayments, useTodayAttendance, buildTransactions
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "fees", icon: "payments" as const, label: "Finance", href: "/admin/fees", tone: "ok" as const },
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/admin/staff", tone: "info" as const },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/admin/approvals", tone: "warn" as const },
  { key: "notices", icon: "campaign" as const, label: "Notices", href: "/admin/notices", tone: "info" as const }
];

export default function AdminHomeRoute() {
  return (
    <AdminShell>
      <AdminHome />
    </AdminShell>
  );
}

function AdminHome() {
  const { t } = useTheme();
  const router = useRouter();
  const { profile } = useMobileSession();
  const { stats, loading, error, refresh } = useDashboardStats();
  const attendance = useTodayAttendance();
  const { payments } = useRecentPayments();
  const { expenses } = useExpenses();
  const { requests } = useLeaveRequests();

  const last7Days = useMemo(() => {
    const buckets: { label: string; value: number }[] = [];
    const today = new Date();
    for (let back = 6; back >= 0; back -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - back);
      const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      let total = 0;
      for (const payment of payments) {
        const normalized = asDateString(payment.createdAt, "");
        if (!normalized) continue;
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) continue;
        const paymentKey = `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
        if (paymentKey === dayKey) total += Number(payment.amountPaid ?? 0);
      }
      buckets.push({
        label: day.toLocaleDateString("en-US", { weekday: "narrow" }),
        value: total
      });
    }
    const peak = Math.max(0, ...buckets.map((b) => b.value));
    return buckets.map((bucket, index) => ({
      label: bucket.label,
      value: bucket.value,
      highlight: index === buckets.length - 1 || (peak > 0 && bucket.value === peak)
    }));
  }, [payments]);

  if (loading && !stats) return <SkeletonPage />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Administrator";
  const txns = useMemo(
    () => buildTransactions(payments, expenses, "All").slice(0, 4),
    [payments, expenses]
  );
  const pendingLeave = requests.filter((r) => r.status === "pending");
  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;

  const tileFor = (tone: "ok" | "warn" | "info" | "bad") => {
    if (tone === "ok") return { bg: t.okBg, tint: t.ok };
    if (tone === "warn") return { bg: t.warnBg, tint: t.warn };
    if (tone === "bad") return { bg: t.badBg, tint: t.bad };
    return { bg: t.tint, tint: t.blue };
  };

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/admin/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={t.blue} />
          </PressableScale>
        }
      />

      {/* collections hero — blue gradient + 7-day chart */}
      <LinearGradient
        colors={[t.heroFrom, t.heroMid, t.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroCircle} pointerEvents="none" />
        <View style={styles.heroTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="caption" tint="rgba(255,255,255,0.8)">
              COLLECTED THIS MONTH
            </DSText>
            <DSText variant="display" tint="#FFFFFF" style={styles.heroMoney}>
              {formatMoney(stats?.monthlyCollection)}
            </DSText>
          </View>
          <PillButton
            label="Details"
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => router.push("/admin/fees" as never)}
          />
        </View>
        <BarChart data={last7Days} height={92} />
      </LinearGradient>

      {/* today snapshot — 3 KPI cards */}
      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="groups" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={36}>
            <Icon name="how-to-reg" size={19} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {`${attendance.present}/${attendance.total}`}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>PRESENT</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={36}>
            <Icon name="error-outline" size={19} tint={t.bad} />
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
          tint={collectionRate >= 75 ? t.ok : t.warn}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="trending-up" size={19} tint={t.ok} /></TonalTile>}
          title={formatMoney(stats?.totalFeeCollected)}
          subtitle="Total collected"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.badBg}><Icon name="error-outline" size={19} tint={t.bad} /></TonalTile>}
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
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={<TonalTile bg={t.warnBg}><Icon name="flight-takeoff" size={19} tint={t.warn} /></TonalTile>}
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
        {QUICK_ACTIONS.map((action) => {
          const tile = tileFor(action.tone);
          return (
            <PressableScale
              key={action.key}
              accessibilityLabel={action.label}
              onPress={() => router.push(action.href as never)}
              style={[styles.quickTile, { backgroundColor: t.card, borderColor: t.line }]}
            >
              <TonalTile bg={tile.bg} size={38}>
                <Icon name={action.icon} size={22} tint={tile.tint} />
              </TonalTile>
              <DSText variant="caption" tint={t.mute} style={{ fontWeight: "500" }}>{action.label}</DSText>
            </PressableScale>
          );
        })}
      </View>

      {/* recent payments */}
      <SectionCard heading="RECENT PAYMENTS">
        {txns.length === 0 ? (
          <DSText variant="label">No payments recorded yet today.</DSText>
        ) : (
          txns.map((row, index) => {
            const income = row.kind === "income";
            return (
              <View key={row.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={
                    <TonalTile bg={income ? t.okBg : t.badBg}>
                      <Icon name="check" size={19} tint={income ? t.ok : t.bad} />
                    </TonalTile>
                  }
                  title={row.title}
                  subtitle={`${income ? "" : "− "}${formatMoney(row.amount)} · ${row.subtitle}`}
                  trailing={<DSText variant="caption">{row.dateLabel}</DSText>}
                />
              </View>
            );
          })
        )}
        {txns.length > 0 ? (
          <PressableScale
            accessibilityLabel="View all receipts"
            onPress={() => router.push("/admin/fees" as never)}
            style={styles.viewAll}
          >
            <DSText variant="bodyMedium" tint={t.blue}>View all</DSText>
            <Icon name="chevron-right" size={18} tint={t.blue} />
          </PressableScale>
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  hero: { borderRadius: radius.xl, padding: space.lg, paddingHorizontal: 18, gap: 4, overflow: "hidden" },
  heroCircle: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
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
  divider: { height: StyleSheet.hairlineWidth },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm
  }
});
