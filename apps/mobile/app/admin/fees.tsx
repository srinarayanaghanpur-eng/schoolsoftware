/**
 * Admin Fees — collection summary, recent receipts and finance position.
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, LoadingState,
  PageTitle, ProgressRow, SectionCard, TonalTile
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { AdminShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useDashboardStats, useFinanceSummary,
  useRecentPayments
} from "@/features/admin/hooks";

const FILTERS = ["All", "Cash", "Online", "Cheque"];

export default function AdminFeesRoute() {
  return (
    <AdminShell>
      <AdminFees />
    </AdminShell>
  );
}

function AdminFees() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");
  const { stats, loading, error, refresh } = useDashboardStats();
  const { payments, refresh: refreshPayments } = useRecentPayments();
  const { summary } = useFinanceSummary();

  const visible = useMemo(() => {
    if (filter === "All") return payments;
    return payments.filter(
      (p) => (p.paymentMethod ?? "").toLowerCase() === filter.toLowerCase()
    );
  }, [payments, filter]);

  if (loading && !stats) return <LoadingState label="Loading fee collection…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { refresh(); refreshPayments(); }}
          tintColor={color.primary}
        />
      }
    >
      <PageTitle>Fees</PageTitle>

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
            <Icon name="error-outline" size={19} tint={color.error} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeOutstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileLavender} size={36}>
            <Icon name="calendar-month" size={19} tint={color.primary} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.monthlyCollection)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>THIS MONTH</DSText>
        </Card>
      </View>

      <Card style={{ gap: space.md }}>
        <DSText variant="overline">COLLECTION PROGRESS</DSText>
        <ProgressRow
          label="Against total demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
        <DSText variant="label">
          {formatMoney(stats?.totalFeeCollected)} of {formatMoney(stats?.totalFeeAmount)} ·{" "}
          {stats?.studentsWithOutstandingFees ?? 0} students still owe
        </DSText>
      </Card>

      {summary ? (
        <SectionCard heading="FINANCE POSITION">
          <ListRow
            leading={<TonalTile bg={color.tileMint}><Icon name="arrow-downward" size={19} tint={color.success} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle="Total income"
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

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading="RECENT RECEIPTS">
        {visible.length === 0 ? (
          <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} payments in this period.`} />
        ) : (
          visible.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<TonalTile bg={color.tileMint}><Icon name="receipt" size={19} tint={color.success} /></TonalTile>}
                title={payment.studentName ?? "Payment"}
                subtitle={`${payment.paymentMethod || "—"}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
                trailing={
                  <View style={{ alignItems: "flex-end" }}>
                    <DSText variant="bodyMedium" tint={color.success} style={styles.receiptMoney}>{formatMoney(payment.amountPaid)}</DSText>
                    <DSText variant="caption">{formatDate(payment.createdAt)}</DSText>
                  </View>
                }
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
  receiptMoney: { fontWeight: "800" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.outline }
});
