/**
 * Admin Fees — collection summary, recent receipts and finance position.
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, LoadingState,
  PageTitle, ProgressRow, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
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
        <StatTile value={formatMoneyShort(stats?.totalFeeCollected)} label="Collected" tint={color.success} />
        <StatTile value={formatMoneyShort(stats?.totalFeeOutstanding)} label="Outstanding" tint={color.error} />
        <StatTile value={formatMoneyShort(stats?.monthlyCollection)} label="This month" tint={color.primary} />
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
            leading={<TonalTile bg={color.successContainer}><Icon name="arrow-downward" size={19} tint={color.success} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle="Total income"
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

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading="RECENT RECEIPTS">
        {visible.length === 0 ? (
          <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} payments in this period.`} />
        ) : (
          visible.map((payment) => (
            <ListRow
              key={payment.id}
              leading={<TonalTile bg={color.successContainer}><Icon name="receipt" size={19} tint={color.success} /></TonalTile>}
              title={payment.studentName ?? "Payment"}
              subtitle={`${payment.paymentMethod || "—"}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
              trailing={
                <View style={{ alignItems: "flex-end" }}>
                  <DSText variant="bodyMedium" tint={color.success}>{formatMoney(payment.amountPaid)}</DSText>
                  <DSText variant="caption">{formatDate(payment.createdAt)}</DSText>
                </View>
              }
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
  statRow: { flexDirection: "row", gap: 10 }
});
