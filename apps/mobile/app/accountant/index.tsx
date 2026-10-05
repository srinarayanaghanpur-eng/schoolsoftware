/**
 * Accountant Home — money-first snapshot.
 *
 * The accountant workspace is read-only on mobile by design: recording
 * payments is a financial write path that needs the server-side transaction
 * and idempotency guarantees of /api/admin/payments, so it stays in the web
 * dashboard rather than being reimplemented as a client-side writer.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Card, DSText, ErrorState, Hero, Icon, ListRow, LoadingState, PillButton,
  PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { AccountantShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useDashboardStats, useFinanceSummary,
  useRecentPayments
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "collections", icon: "receipt-long" as const, label: "Collections", href: "/accountant/collections", tile: color.tileMint, tint: color.success },
  { key: "dues", icon: "schedule" as const, label: "Dues", href: "/accountant/dues", tile: color.tilePeach, tint: color.warning },
  { key: "profile", icon: "person-outline" as const, label: "Profile", href: "/accountant/profile", tile: color.tileSky, tint: color.primary }
];

export default function AccountantHomeRoute() {
  return (
    <AccountantShell>
      <AccountantHome />
    </AccountantShell>
  );
}

function AccountantHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useMobileSession();
  const { stats, loading, error, refresh } = useDashboardStats();
  const { payments } = useRecentPayments();
  const { summary } = useFinanceSummary();

  if (loading && !stats) return <LoadingState label="Loading collections…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Accounts";
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
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/accountant/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={color.success} />
          </PressableScale>
        }
      />

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
          label="Receipts"
          bg={color.surface}
          fg={color.onPrimaryContainer}
          onPress={() => router.push("/accountant/collections" as never)}
        />
      </Hero>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileMint} size={36}>
            <Icon name="trending-up" size={19} tint={color.success} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeCollected)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>COLLECTED</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileRose} size={36}>
            <Icon name="schedule" size={19} tint={color.error} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeOutstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tilePeach} size={36}>
            <Icon name="group" size={19} tint={color.warning} />
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
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
      </SectionCard>

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

      {summary ? (
        <SectionCard heading="INCOME VS EXPENSE">
          <ListRow
            leading={<TonalTile bg={color.tileMint}><Icon name="arrow-downward" size={19} tint={color.success} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle={`Fees ${formatMoneyShort(summary.income.fees)} · Other ${formatMoneyShort(summary.income.other)}`}
          />
          <View style={styles.divider} />
          <ListRow
            leading={<TonalTile bg={color.tileRose}><Icon name="arrow-upward" size={19} tint={color.error} /></TonalTile>}
            title={formatMoney(summary.expense.total)}
            subtitle={`Salary ${formatMoneyShort(summary.expense.salary)} · General ${formatMoneyShort(summary.expense.general)}`}
          />
          <View style={styles.divider} />
          <ListRow
            leading={
              <TonalTile bg={summary.net >= 0 ? color.tileSky : color.tileRose}>
                <Icon name="account-balance" size={19} tint={summary.net >= 0 ? color.primary : color.error} />
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
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<TonalTile bg={color.tileMint}><Icon name="receipt" size={19} tint={color.success} /></TonalTile>}
                title={payment.studentName ?? "Payment"}
                subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
              />
            </View>
          ))
        )}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Recording payments and issuing receipts is done in the web dashboard.
      </DSText>
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
    borderRadius: radius.lg,
    ...elevation.card
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
