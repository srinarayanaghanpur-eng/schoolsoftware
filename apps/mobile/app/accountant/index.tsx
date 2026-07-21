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
  Avatar, DSText, ErrorState, Hero, Icon, ListRow, LoadingState, PillButton,
  PressableScale, ProgressRow, ScreenHeader, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { AccountantShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useDashboardStats, useFinanceSummary,
  useRecentPayments
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "collections", icon: "receipt-long" as const, label: "Collections", href: "/accountant/collections" },
  { key: "dues", icon: "schedule" as const, label: "Dues", href: "/accountant/dues" },
  { key: "profile", icon: "person-outline" as const, label: "Profile", href: "/accountant/profile" }
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
          <DSText variant="display" tint={color.onPrimary} style={{ fontSize: 26 }}>
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
        <StatTile value={formatMoneyShort(stats?.totalFeeCollected)} label="Collected" tint={color.success} />
        <StatTile value={formatMoneyShort(stats?.totalFeeOutstanding)} label="Outstanding" tint={color.error} />
        <StatTile value={stats?.studentsWithOutstandingFees ?? 0} label="With dues" tint={color.warning} />
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
            <Icon name={action.icon} size={22} tint={color.primary} />
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {summary ? (
        <SectionCard heading="INCOME VS EXPENSE">
          <ListRow
            leading={<TonalTile bg={color.successContainer}><Icon name="arrow-downward" size={19} tint={color.success} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle={`Fees ${formatMoneyShort(summary.income.fees)} · Other ${formatMoneyShort(summary.income.other)}`}
          />
          <ListRow
            leading={<TonalTile bg={color.errorContainer}><Icon name="arrow-upward" size={19} tint={color.error} /></TonalTile>}
            title={formatMoney(summary.expense.total)}
            subtitle={`Salary ${formatMoneyShort(summary.expense.salary)} · General ${formatMoneyShort(summary.expense.general)}`}
          />
          <ListRow
            leading={
              <TonalTile bg={summary.net >= 0 ? color.successContainer : color.errorContainer}>
                <Icon name="account-balance" size={19} tint={summary.net >= 0 ? color.success : color.error} />
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
          payments.slice(0, 4).map((payment) => (
            <ListRow
              key={payment.id}
              leading={<TonalTile bg={color.successContainer}><Icon name="receipt" size={19} tint={color.success} /></TonalTile>}
              title={payment.studentName ?? "Payment"}
              subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
              trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
            />
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
