/**
 * Accountant Home — money-first snapshot.
 *
 * The accountant workspace is read-only on mobile by design: recording
 * payments is a financial write path that needs the server-side transaction
 * and idempotency guarantees of /api/admin/payments, so it stays in the web
 * dashboard rather than being reimplemented as a client-side writer.
 */
import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, Card, DSText, ErrorState, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile
} from "@/design-system/components";
import { BarChart } from "@/design-system/widgets";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { asDateString } from "@/lib/text";
import { useMobileSession } from "@/lib/mobileSession";
import { AccountantShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useDashboardStats, useFinanceSummary,
  useRecentPayments
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "collections", icon: "receipt-long" as const, label: "Collections", href: "/accountant/collections", tone: "ok" as const },
  { key: "dues", icon: "schedule" as const, label: "Dues", href: "/accountant/dues", tone: "warn" as const },
  { key: "profile", icon: "person-outline" as const, label: "Profile", href: "/accountant/profile", tone: "info" as const }
];

export default function AccountantHomeRoute() {
  return (
    <AccountantShell>
      <AccountantHome />
    </AccountantShell>
  );
}

function AccountantHome() {
  const { t } = useTheme();
  const router = useRouter();
  const { profile } = useMobileSession();
  const { stats, loading, error, refresh } = useDashboardStats();
  const { payments } = useRecentPayments();
  const { summary } = useFinanceSummary();

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

  if (loading && !stats) return <LoadingState label="Loading collections…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Accounts";
  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;

  const tileFor = (tone: "ok" | "warn" | "info") => {
    if (tone === "ok") return { bg: t.okBg, tint: t.ok };
    if (tone === "warn") return { bg: t.warnBg, tint: t.warn };
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
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/accountant/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={t.blue} />
          </PressableScale>
        }
      />

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
            label="Receipts"
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => router.push("/accountant/collections" as never)}
          />
        </View>
        <BarChart data={last7Days} height={92} />
      </LinearGradient>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={36}>
            <Icon name="trending-up" size={19} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeCollected)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>COLLECTED</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={36}>
            <Icon name="schedule" size={19} tint={t.bad} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeOutstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.warnBg} size={36}>
            <Icon name="group" size={19} tint={t.warn} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.studentsWithOutstandingFees ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>WITH DUES</DSText>
        </Card>
      </View>

      <SectionCard heading="COLLECTION PROGRESS">
        <ProgressRow
          label="Against total demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? t.ok : t.warn}
        />
      </SectionCard>

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

      {summary ? (
        <SectionCard heading="INCOME VS EXPENSE">
          <ListRow
            leading={<TonalTile bg={t.okBg}><Icon name="arrow-downward" size={19} tint={t.ok} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle={`Fees ${formatMoneyShort(summary.income.fees)} · Other ${formatMoneyShort(summary.income.other)}`}
          />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <ListRow
            leading={<TonalTile bg={t.badBg}><Icon name="arrow-upward" size={19} tint={t.bad} /></TonalTile>}
            title={formatMoney(summary.expense.total)}
            subtitle={`Salary ${formatMoneyShort(summary.expense.salary)} · General ${formatMoneyShort(summary.expense.general)}`}
          />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <ListRow
            leading={
              <TonalTile bg={summary.net >= 0 ? t.tint : t.badBg}>
                <Icon name="account-balance" size={19} tint={summary.net >= 0 ? t.blue : t.bad} />
              </TonalTile>
            }
            title={formatMoney(summary.net)}
            subtitle="Net position"
          />
        </SectionCard>
      ) : null}

      <SectionCard heading="RECENT RECEIPTS">
        {payments.length === 0 ? (
          <DSText variant="label">No payments recorded yet.</DSText>
        ) : (
          payments.slice(0, 4).map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={<TonalTile bg={t.okBg}><Icon name="receipt" size={19} tint={t.ok} /></TonalTile>}
                title={payment.studentName ?? "Payment"}
                subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
              />
            </View>
          ))
        )}
        {payments.length > 0 ? (
          <PressableScale
            accessibilityLabel="View all receipts"
            onPress={() => router.push("/accountant/collections" as never)}
            style={styles.viewAll}
          >
            <DSText variant="bodyMedium" tint={t.blue}>View all</DSText>
            <Icon name="chevron-right" size={18} tint={t.blue} />
          </PressableScale>
        ) : null}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Recording payments and issuing receipts is done in the web dashboard.
      </DSText>
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
